import { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { loadState, saveState } from './storage'

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = string
type Unit = 'un' | 'L' | 'kg' | 'cx' | 'pct' | 'rolos' | 'pares' | 'm' | 'frascos' | 'fardos' | 'rolo'
type Tab = 'estoque' | 'movimentacoes' | 'alertas' | 'ajustes'
type FilterType = 'todos' | 'normal' | 'atencao' | 'critico' | 'zerado'
type AdjustMode = 'add' | 'remove' | 'consume'

const MONTHS = [
  { i: 0,  short: 'Jan', full: 'Janeiro' },
  { i: 1,  short: 'Fev', full: 'Fevereiro' },
  { i: 2,  short: 'Mar', full: 'Março' },
  { i: 3,  short: 'Abr', full: 'Abril' },
  { i: 4,  short: 'Mai', full: 'Maio' },
  { i: 5,  short: 'Jun', full: 'Junho' },
  { i: 6,  short: 'Jul', full: 'Julho' },
  { i: 7,  short: 'Ago', full: 'Agosto' },
  { i: 8,  short: 'Set', full: 'Setembro' },
  { i: 9,  short: 'Out', full: 'Outubro' },
  { i: 10, short: 'Nov', full: 'Novembro' },
  { i: 11, short: 'Dez', full: 'Dezembro' },
] as const

interface Movement {
  id: string
  productId: string
  type: 'entrada' | 'saida' | 'consumo' | 'ajuste'
  quantity: number
  note: string
  date: Date
}

interface Product {
  id: string
  name: string
  category: Category
  unit: Unit
  stock: number
  minStock: number
  idealStock?: number
  used: number
  icon: string
  notes: string
}

// ─── Data ─────────────────────────────────────────────────────────────────────

// icon field is now a key into PRODUCT_ICONS (SVG-based, always renders)
// Produtos sincronizados com lista Julho/Agosto 2026 (dados de Agosto/2026)
const initialProducts: Product[] = [
  // DML
  { id: 'p01',  name: 'Álcool 70',                 category: 'Limpeza',    unit: 'un',      stock: 16, minStock: 17, used: 1,  icon: 'flask',     notes: '' },
  { id: 'p02',  name: 'Álcool Gel 5L',             category: 'Limpeza',    unit: 'un',      stock: 1,  minStock: 4,  used: 0,  icon: 'flask',     notes: '' },
  { id: 'p03',  name: 'Bom Ar',                    category: 'Limpeza',    unit: 'un',      stock: 4,  minStock: 2,  used: 2,  icon: 'spray',     notes: '' },
  { id: 'p04',  name: 'Bombril',                   category: 'Limpeza',    unit: 'pct',     stock: 1,  minStock: 4,  used: 0,  icon: 'sponge',    notes: '' },
  { id: 'p05',  name: 'Borrifadores',              category: 'Limpeza',    unit: 'un',      stock: 3,  minStock: 4,  used: 0,  icon: 'spray',     notes: '' },
  { id: 'p06',  name: 'Bucha Verde',               category: 'Limpeza',    unit: 'un',      stock: 1,  minStock: 4,  used: 2,  icon: 'sponge',    notes: '' },
  { id: 'p07',  name: 'Cabelo de Mop',             category: 'Limpeza',    unit: 'un',      stock: 2,  minStock: 1,  used: 5,  icon: 'mop',       notes: '' },
  { id: 'p08',  name: 'Café',                      category: 'Cozinha',    unit: 'un',      stock: 17, minStock: 17, used: 23, icon: 'bottle',    notes: '' },
  { id: 'p09',  name: 'Cloro Gel',                 category: 'Limpeza',    unit: 'frascos', stock: 2,  minStock: 2,  used: 2,  icon: 'water',     notes: '' },
  { id: 'p10',  name: 'Cloro Gel Diluído',         category: 'Limpeza',    unit: 'un',      stock: 2,  minStock: 1,  used: 0,  icon: 'water',     notes: '' },
  { id: 'p11',  name: 'Copos Descartáveis',        category: 'Escritório', unit: 'cx',      stock: 1,  minStock: 4,  used: 0,  icon: 'bottle',    notes: '' },
  { id: 'p12',  name: 'Desentupidor Banheiro',     category: 'Limpeza',    unit: 'un',      stock: 2,  minStock: 4,  used: 0,  icon: 'cleaner',   notes: '' },
  { id: 'p13',  name: 'Desinfetante Diluído 5L',   category: 'Limpeza',    unit: 'un',      stock: 18, minStock: 2,  used: 5,  icon: 'spray',     notes: '' },
  { id: 'p14',  name: 'Detergente 5L',             category: 'Limpeza',    unit: 'un',      stock: 3,  minStock: 1,  used: 0,  icon: 'bottle',    notes: '' },
  { id: 'p15',  name: 'Difusores',                 category: 'Limpeza',    unit: 'un',      stock: 33, minStock: 4,  used: 0,  icon: 'spray',     notes: '' },
  { id: 'p16',  name: 'Escova de Limpeza de Cabo', category: 'Limpeza',    unit: 'un',      stock: 1,  minStock: 4,  used: 0,  icon: 'broom',     notes: '' },
  { id: 'p17',  name: 'Esfregão Amarelo',          category: 'Limpeza',    unit: 'un',      stock: 1,  minStock: 4,  used: 0,  icon: 'sponge',    notes: '' },
  { id: 'p18',  name: 'Espanadores',               category: 'Limpeza',    unit: 'un',      stock: 2,  minStock: 4,  used: 0,  icon: 'broom',     notes: '' },
  { id: 'p19',  name: 'Grampo de Roupa',           category: 'Escritório', unit: 'pct',     stock: 0,  minStock: 4,  used: 1,  icon: 'cleaner',   notes: '' },
  { id: 'p20',  name: 'Koala',                     category: 'Limpeza',    unit: 'un',      stock: 4,  minStock: 2,  used: 1,  icon: 'cleaner',   notes: '' },
  { id: 'p21',  name: 'Limpa Tudo 5L',             category: 'Limpeza',    unit: 'un',      stock: 2,  minStock: 1,  used: 0,  icon: 'cleaner',   notes: '' },
  { id: 'p22',  name: 'Luvas',                     category: 'Segurança',  unit: 'cx',      stock: 1,  minStock: 1,  used: 0,  icon: 'gloves',    notes: '' },
  { id: 'p23',  name: 'Mata-Formigas Formikel',    category: 'Limpeza',    unit: 'un',      stock: 1,  minStock: 4,  used: 1,  icon: 'spray',     notes: '' },
  { id: 'p24',  name: 'Panos Xadrez',              category: 'Limpeza',    unit: 'un',      stock: 15, minStock: 15, used: 0,  icon: 'cloth',     notes: '' },
  { id: 'p25',  name: 'Papel Higiênico ADM',       category: 'Higiene',    unit: 'un',      stock: 7,  minStock: 2,  used: 2,  icon: 'toiletroll',notes: '' },
  { id: 'p26',  name: 'Papel Higiênico do Aluno',  category: 'Higiene',    unit: 'fardos',  stock: 24, minStock: 10, used: 11, icon: 'toiletroll',notes: '' },
  { id: 'p27',  name: 'Papel Toalha',              category: 'Higiene',    unit: 'fardos',  stock: 14, minStock: 2,  used: 16, icon: 'roll',      notes: '' },
  { id: 'p28',  name: 'Rolo de Perflex',           category: 'Limpeza',    unit: 'rolo',    stock: 1,  minStock: 4,  used: 1,  icon: 'roll',      notes: '' },
  { id: 'p29',  name: 'Sabão em Pó 500g',          category: 'Limpeza',    unit: 'un',      stock: 1,  minStock: 4,  used: 0,  icon: 'powder',    notes: '' },
  { id: 'p30',  name: 'Sabonete Líquido 5L',       category: 'Higiene',    unit: 'un',      stock: 2,  minStock: 3,  used: 2,  icon: 'pump',      notes: '' },
  { id: 'p31',  name: 'Saco de Lixo 100L',         category: 'Limpeza',    unit: 'pct',     stock: 2,  minStock: 4,  used: 0,  icon: 'bottle',    notes: '' },
  { id: 'p32',  name: 'Saco de Lixo 150L',         category: 'Limpeza',    unit: 'un',      stock: 2,  minStock: 2,  used: 2,  icon: 'bottle',    notes: '' },
  { id: 'p33',  name: 'Saco de Lixo 20L',          category: 'Limpeza',    unit: 'un',      stock: 2,  minStock: 2,  used: 0,  icon: 'bottle',    notes: '' },
  { id: 'p34',  name: 'Saco de Lixo 200L',         category: 'Limpeza',    unit: 'pct',     stock: 1,  minStock: 4,  used: 1,  icon: 'bottle',    notes: '' },
  { id: 'p35',  name: 'Saco de Lixo 60L',          category: 'Limpeza',    unit: 'pct',     stock: 2,  minStock: 4,  used: 0,  icon: 'bottle',    notes: '' },
  { id: 'p36',  name: 'Sapólio 250g',              category: 'Limpeza',    unit: 'un',      stock: 2,  minStock: 4,  used: 1,  icon: 'powder',    notes: '' },
  { id: 'p37',  name: 'Sapólio 450g',              category: 'Limpeza',    unit: 'un',      stock: 2,  minStock: 4,  used: 0,  icon: 'powder',    notes: '' },
  { id: 'p38',  name: 'Vassouras',                 category: 'Limpeza',    unit: 'un',      stock: 3,  minStock: 4,  used: 0,  icon: 'broom',     notes: '' },
  // SALA DE REUNIÃO
  { id: 'p39',  name: 'Balas',                     category: 'Escritório', unit: 'pct',     stock: 1,  minStock: 4,  used: 1,  icon: 'bottle',    notes: '' },
  { id: 'p40',  name: 'Bolachas',                  category: 'Escritório', unit: 'pct',     stock: 0,  minStock: 4,  used: 1,  icon: 'bottle',    notes: '' },
  // SECRETARIA / COZINHA
  { id: 'p41',  name: 'Açúcar',                    category: 'Cozinha',    unit: 'kg',      stock: 15, minStock: 5,  used: 9,  icon: 'powder',    notes: '' },
  { id: 'p42',  name: 'Chá de Camomila',           category: 'Cozinha',    unit: 'cx',      stock: 19, minStock: 10, used: 0,  icon: 'bottle',    notes: '' },
  { id: 'p43',  name: 'Chá de Erva-Cidreira',      category: 'Cozinha',    unit: 'cx',      stock: 10, minStock: 10, used: 0,  icon: 'bottle',    notes: '' },
]

const initialMovements: Movement[] = [
  { id: 'm1', productId: 'p01', type: 'consumo', quantity: 1,  note: 'Uso diário',           date: new Date(Date.now() - 3600000) },
  { id: 'm2', productId: 'p27', type: 'consumo', quantity: 16, note: 'Reposição banheiros',  date: new Date(Date.now() - 3*3600000) },
  { id: 'm3', productId: 'p22', type: 'entrada', quantity: 1,  note: 'Compra fornecedor',    date: new Date(Date.now() - 2*86400000) },
  { id: 'm4', productId: 'p09', type: 'consumo', quantity: 2,  note: 'Limpeza geral',        date: new Date(Date.now() - 6*3600000) },
  { id: 'm5', productId: 'p08', type: 'consumo', quantity: 23, note: 'Consumo mensal',       date: new Date(Date.now() - 3*86400000) },
  { id: 'm6', productId: 'p26', type: 'consumo', quantity: 11, note: 'Distribuição alunos',  date: new Date(Date.now() - 4*3600000) },
  { id: 'm7', productId: 'p41', type: 'consumo', quantity: 9,  note: 'Cozinha/secretaria',   date: new Date(Date.now() - 8*3600000) },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stockStatus(p: Product): 'ok' | 'low' | 'critical' | 'empty' {
  if (p.stock === 0) return 'empty'
  if (p.stock < p.minStock) return 'critical'
  if (p.stock < p.minStock * 1.5) return 'low'
  return 'ok'
}

function stockPct(p: Product): number {
  const max = Math.max(p.stock, p.minStock * 3, 20)
  return Math.min(100, (p.stock / max) * 100)
}

function idealStockOf(p: Product): number {
  return p.idealStock ?? p.minStock
}

function qtyToBuy(p: Product): number {
  return Math.max(0, idealStockOf(p) - p.stock)
}

function uid() { return Math.random().toString(36).slice(2) }

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  if (h < 48) return 'ontem'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// ─── Design tokens (resolved via CSS custom properties) ───────────────────────

const CARD      = 'var(--tok-card)'
const BLUE      = 'var(--tok-blue)'
const AMBER     = 'var(--tok-amber)'
const CORAL     = 'var(--tok-coral)'
const LABEL     = 'var(--tok-label)'
const SUBLABEL  = 'var(--tok-sublabel)'
const CAPTION   = 'var(--tok-caption)'
const FILL      = 'var(--tok-fill)'
const FILL2     = 'var(--tok-fill2)'
const BORDER    = 'var(--tok-border)'
const SHADOW    = 'var(--tok-shadow)'
const SIDEBAR   = 'var(--tok-sidebar)'
const HEADER_BG = 'var(--tok-header-bg)'
const INK       = 'var(--tok-ink)'
const INK_FG    = 'var(--tok-ink-fg)'
const FW_LIGHT  = 300
const FW_NORMAL = 400
const FW_BOLD   = 700
const GLASS: React.CSSProperties = {
  background: CARD,
  backdropFilter: 'blur(28px) saturate(1.35)',
  WebkitBackdropFilter: 'blur(28px) saturate(1.35)',
  boxShadow: SHADOW,
  border: `1px solid ${BORDER}`,
}

const DEFAULT_CATEGORIES: Category[] = ['Limpeza', 'Higiene', 'Escritório', 'Cozinha', 'Segurança', 'Manutenção']
const CAT_PALETTE = ['#5B9FD4', '#4ECDC4', '#F0A020', '#6FCF6F', '#8B9AE8', '#C4A35A', '#E88984', '#A78BFA']
const CAT_ACCENT: Record<string, string> = {
  Limpeza: '#5B9FD4',
  Higiene: '#4ECDC4',
  Escritório: '#F0A020',
  Cozinha: '#6FCF6F',
  Segurança: '#8B9AE8',
  Manutenção: '#C4A35A',
}

function catAccent(name: string): string {
  if (CAT_ACCENT[name]) return CAT_ACCENT[name]
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return CAT_PALETTE[h % CAT_PALETTE.length]
}

function uniqueCategories(list: string[]): Category[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of list) {
    const t = raw.trim()
    if (!t) continue
    const k = t.toLocaleLowerCase('pt-BR')
    if (seen.has(k)) continue
    seen.add(k)
    out.push(t)
  }
  return out.length ? out : [...DEFAULT_CATEGORIES]
}

const STATUS_META = {
  ok:       { label: 'Normal',  dot: '#D7C4A8', text: '#F0D5C4', bg: 'rgba(240,213,196,0.16)',  iconBg: 'rgba(240,213,196,0.16)', iconBorder: 'rgba(240,213,196,0.32)', iconColor: '#F0D5C4' },
  low:      { label: 'Atenção', dot: '#E8B07A', text: '#F0C9A0', bg: 'rgba(232,176,122,0.16)',  iconBg: 'rgba(232,176,122,0.16)', iconBorder: 'rgba(232,176,122,0.32)', iconColor: '#F0C9A0' },
  critical: { label: 'Crítico', dot: '#E88984', text: '#E88984', bg: 'rgba(232,137,132,0.16)',  iconBg: 'rgba(232,137,132,0.16)', iconBorder: 'rgba(232,137,132,0.32)', iconColor: '#E88984' },
  empty:    { label: 'Zerado',  dot: 'rgba(255,255,255,0.45)', text: 'rgba(255,250,246,0.7)', bg: 'rgba(255,255,255,0.10)', iconBg: 'rgba(255,255,255,0.10)', iconBorder: 'rgba(255,255,255,0.22)', iconColor: 'rgba(255,255,255,0.7)' },
}

const MOV_META = {
  entrada: { label: 'Entrada', color: BLUE, bg: 'rgba(var(--tok-blue-rgb),0.12)', sign: '+' },
  saida:   { label: 'Saída',   color: '#FF9500', bg: 'rgba(255,149,0,0.13)',  sign: '−' },
  consumo: { label: 'Consumo', color: '#FF6A6A', bg: 'rgba(255,106,106,0.13)',sign: '−' },
  ajuste:  { label: 'Ajuste',  color: BLUE, bg: 'rgba(var(--tok-blue-rgb),0.12)', sign: '±' },
}

// ─── Product SVG icons (emoji-free, always renders) ──────────────────────────

const PRODUCT_ICONS: Record<string, React.ReactNode> = {
  flask: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6M10 3v5.4L6.2 15a4 4 0 0 0 3.4 6h4.8a4 4 0 0 0 3.4-6L14 8.4V3"/>
      <path d="M6.5 15.5h11"/>
    </svg>
  ),
  spray: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9h4v10a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V9h2V7H3v2z"/>
      <path d="M13 7V5a2 2 0 0 1 2-2h2"/>
      <path d="M17 5h2M19 7h2M17 9h2"/>
    </svg>
  ),
  bottle: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2h4v3l2 2v13a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V7l2-2V2z"/>
      <path d="M8 12h8"/>
    </svg>
  ),
  sponge: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="18" height="12" rx="3"/>
      <path d="M3 13h18"/>
      <path d="M8 7V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/>
      <circle cx="8" cy="10" r="1" fill="currentColor"/>
      <circle cx="12" cy="10" r="1" fill="currentColor"/>
      <circle cx="16" cy="10" r="1" fill="currentColor"/>
    </svg>
  ),
  roll: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2"/>
      <circle cx="12" cy="12" r="3"/>
      <circle cx="12" cy="12" r="1" fill="currentColor"/>
      <path d="M4 8h16M4 16h16"/>
    </svg>
  ),
  powder: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 8h14l-1 12H6L5 8z"/>
      <path d="M3 8h18"/>
      <path d="M9 8V5a3 3 0 0 1 6 0v3"/>
      <path d="M10 13c1 1 3 1 4 0"/>
    </svg>
  ),
  gloves: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 13V7a1 1 0 0 1 2 0v4M10 7V4a1 1 0 0 1 2 0v5M12 5V4a1 1 0 0 1 2 0v5M14 5.5a1 1 0 0 1 2 0V12"/>
      <path d="M8 11v2a6 6 0 0 0 6 6h0a6 6 0 0 0 6-6V9a1 1 0 0 0-2 0"/>
    </svg>
  ),
  water: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C6 10 4 14 4 16a8 8 0 0 0 16 0c0-2-2-6-8-14z"/>
      <path d="M8 17a4 4 0 0 0 4 3"/>
    </svg>
  ),
  cloth: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="14" rx="2"/>
      <path d="M2 10h20M2 14h20"/>
      <path d="M6 6V4M12 6V4M18 6V4"/>
    </svg>
  ),
  mop: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v12"/>
      <path d="M8 14h8l1 6H7l1-6z"/>
      <path d="M9 17h6"/>
    </svg>
  ),
  broom: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22l10-10"/>
      <path d="M14 12l2-8 6 2-3 7H14z"/>
      <path d="M14 12l-4 6-4-2 3-4h5z"/>
    </svg>
  ),
  cleaner: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 8h10v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V8z"/>
      <path d="M7 8V6a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v2"/>
      <path d="M12 5v3M10 13l4 4M14 13l-4 4"/>
    </svg>
  ),
  toiletroll: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="12" rx="8" ry="10"/>
      <ellipse cx="12" cy="12" rx="3" ry="4"/>
      <path d="M15 12c0 2.5 3 4 5 2"/>
    </svg>
  ),
  pump: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 21V9a3 3 0 0 1 6 0v12H10z"/>
      <path d="M10 13h6"/>
      <path d="M13 9V5"/>
      <path d="M11 5h6v2h-6z"/>
    </svg>
  ),
  mask: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9a8 8 0 0 1 16 0v4a8 8 0 0 1-16 0V9z"/>
      <path d="M4 11h16"/>
      <path d="M9 15c1 1 5 1 6 0"/>
      <path d="M4 9C2 9 2 11 2 12s0 3 2 3"/>
      <path d="M20 9c2 0 2 2 2 3s0 3-2 3"/>
    </svg>
  ),
}

function ProdIcon({ iconKey, size = 22, color = AMBER }: { iconKey: string; size?: number; color?: string }) {
  const svg = PRODUCT_ICONS[iconKey] ?? PRODUCT_ICONS['bottle']
  return (
    <span style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
      <span style={{ width: size, height: size, display: 'block' }}>{svg}</span>
    </span>
  )
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function Pill({ status }: { status: ReturnType<typeof stockStatus> }) {
  const m = STATUS_META[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: FW_BOLD, letterSpacing: 0.1,
      color: m.text, background: m.bg,
      padding: '3px 9px', borderRadius: 20,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: m.dot, flexShrink: 0 }} />
      {m.label}
    </span>
  )
}

function Bar({ product, height = 5 }: { product: Product; height?: number }) {
  const pct = stockPct(product)
  const s = stockStatus(product)
  const clr = { ok: AMBER, low: '#E8B07A', critical: CORAL, empty: 'rgba(255,255,255,0.28)' }[s]
  return (
    <div style={{ height, background: 'rgba(255,255,255,0.14)', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: clr, borderRadius: 99, transition: 'width .5s ease' }} />
    </div>
  )
}

function IconBox({ emoji, size = 44, radius = 14, bg = FILL }: { emoji: string; size?: number; radius?: number; bg?: string }) {
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.48, flexShrink: 0 }}>
      {emoji}
    </div>
  )
}

// SVG icons — kept as named constants so TSX can render them directly
const Ic = {
  search: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  plus:   <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
  minus:  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14"/></svg>,
  chev:   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>,
  edit:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  close:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  box:    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  list:   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  bell:   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  gear:   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  arrow:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>,
  funnel: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16l-6.5 8.2V18l-3 2v-7.8L4 4z"/></svg>,
  calendar: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>,
  shield: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l8 3v6c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3z"/></svg>,
  warn: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  trend:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>,
}

// ─── Bottom Sheet ─────────────────────────────────────────────────────────────

function Sheet({ onClose, children, fit }: { onClose: () => void; children: React.ReactNode; fit?: boolean }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(18,10,12,0.28)', backdropFilter: 'blur(14px)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}
      onClick={onClose}
    >
      <div
        className={fit ? 'sheet-fit' : undefined}
        style={{
          width: '100%', maxWidth: 520, ...GLASS, borderRadius: '28px 28px 0 0', borderBottom: 'none',
          maxHeight: fit ? '100dvh' : '92dvh',
          height: fit ? '100dvh' : undefined,
          overflowY: fit ? 'hidden' : 'auto',
          display: fit ? 'flex' : undefined,
          flexDirection: fit ? 'column' : undefined,
          animation: 'slideUp .32s cubic-bezier(.34,1.4,.64,1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: fit ? 8 : 12, paddingBottom: 2, flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: 'rgba(120,120,128,0.28)' }} />
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── Stat Tile ────────────────────────────────────────────────────────────────

function RingStat({ label, display, color, pct, icon, title }: {
  label: string; display: string; color: string; pct: number; icon: React.ReactNode; title?: string
}) {
  const size = 100
  const r = 37
  const c = 2 * Math.PI * r
  const dash = c * Math.min(1, Math.max(0, pct))
  const numSize = display.length > 3 ? 18 : 22
  return (
    <div title={title} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <div className="ring-stat-frost" aria-hidden />
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'relative', zIndex: 1, transform: 'rotate(-90deg)', filter: `drop-shadow(0 0 6px ${color}88)` }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="7" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${dash} ${c}`} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: 8 }}>
          <div style={{ fontSize: numSize, fontWeight: FW_BOLD, color, lineHeight: 1, letterSpacing: -1, textShadow: '0 2px 10px rgba(6,12,28,0.95)' }}>{display}</div>
          <div style={{ fontSize: 10, color: '#FFFBFA', fontWeight: FW_BOLD, marginTop: 4, textShadow: '0 1px 8px rgba(6,12,28,0.95)' }}>{label}</div>
        </div>
        <div style={{ position: 'absolute', left: '50%', bottom: 5, transform: 'translateX(-50%)', zIndex: 2, color, opacity: 1 }}>{icon}</div>
      </div>
    </div>
  )
}

// ─── Product Row (list item) ──────────────────────────────────────────────────

function ProductRow({ product, onSelect, onAdd, onRemove }: {
  product: Product; onSelect: () => void; onAdd: () => void; onRemove: () => void; isLast?: boolean
}) {
  const s = stockStatus(product)
  const low = s === 'critical' || s === 'empty'
  const accent = low ? '#E04B45' : catAccent(product.category)

  return (
    <div
      onClick={onSelect}
      style={{ ...GLASS, borderRadius: 18, cursor: 'pointer', overflow: 'hidden', transition: 'transform .15s', position: 'relative' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <div
        className={low ? 'product-edge--low' : undefined}
        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: low ? undefined : accent, borderRadius: '18px 0 0 18px', zIndex: 1 }}
      />
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px 8px 16px' }}>

        {/* Name + subtitle */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: FW_BOLD, fontSize: 15, color: '#FFFBFA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2, textShadow: '0 1px 6px rgba(6,12,28,0.8)' }}>
            {product.name}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,250,246,0.82)', fontWeight: FW_NORMAL, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            min {product.minStock} · ideal {idealStockOf(product)} {product.unit}
          </div>
        </div>

        {/* Estoque */}
        <div title="Estoque no depósito (quantidade na unidade do produto)" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 48, flexShrink: 0 }}>
          <span style={{ fontSize: 9, fontWeight: FW_BOLD, color: '#7FEDE6', textTransform: 'uppercase', letterSpacing: 0.3, lineHeight: 1 }}>estoque</span>
          <span style={{ fontSize: 20, fontWeight: FW_BOLD, color: '#FFFBFA', lineHeight: 1.05, letterSpacing: -0.8 }}>{product.stock}</span>
          <span style={{ fontSize: 10, color: 'rgba(255,250,246,0.78)', lineHeight: 1.2 }}>de {idealStockOf(product)} {product.unit}</span>
        </div>

        <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.28)', flexShrink: 0 }} />

        {/* Em uso */}
        <div title="Quantidade já retirada / em uso, na mesma unidade" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 44, flexShrink: 0 }}>
          <span style={{ fontSize: 9, fontWeight: FW_BOLD, color: '#F0A8A4', textTransform: 'uppercase', letterSpacing: 0.3, lineHeight: 1 }}>em uso</span>
          <span style={{ fontSize: 20, fontWeight: FW_BOLD, color: product.used > 0 ? '#F3B4B0' : 'rgba(255,250,246,0.55)', lineHeight: 1.05, letterSpacing: -0.8 }}>{product.used}</span>
          <span style={{ fontSize: 10, color: 'rgba(255,250,246,0.78)', lineHeight: 1.2 }}>{product.unit}</span>
        </div>

        <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.28)', flexShrink: 0 }} />

        {/* Stepper — two equal circles in a capsule (reference) */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0,
            padding: 5, borderRadius: 999,
            background: 'linear-gradient(180deg, rgba(18,28,48,0.9), rgba(8,14,28,0.75))',
            border: '1px solid rgba(180,210,240,0.18)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          <button
            onClick={onAdd}
            aria-label="Entrada"
            style={{
              width: 26, height: 26, borderRadius: '50%', padding: 0,
              background: 'radial-gradient(circle at 50% 38%, #1c2430 0%, #0e141c 72%)',
              color: '#FFFBFA',
              border: '1.5px solid #4ECDC4',
              boxShadow: '0 0 0 1px rgba(78,205,196,0.25), 0 0 7px rgba(78,205,196,0.55), inset 0 1px 2px rgba(0,0,0,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          </button>
          <button
            onClick={onRemove}
            aria-label="Retirada"
            style={{
              width: 26, height: 26, borderRadius: '50%', padding: 0,
              background: 'radial-gradient(circle at 50% 38%, #1c2430 0%, #0e141c 72%)',
              color: '#FFFBFA',
              border: '1.5px solid rgba(90,130,180,0.45)',
              boxShadow: '0 0 0 1px rgba(40,70,110,0.35), inset 0 1px 2px rgba(0,0,0,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 12h14"/></svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Quick Adjust Modal ───────────────────────────────────────────────────────

function QuickAdjust({ product, mode, onConfirm, onCancel }: {
  product: Product; mode: AdjustMode
  onConfirm: (qty: number, note: string) => void; onCancel: () => void
}) {
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const meta = {
    add:     { title: 'Entrada de estoque',  color: BLUE,  action: 'Confirmar entrada'  },
    remove:  { title: 'Retirada de estoque', color: CORAL, action: 'Confirmar retirada' },
    consume: { title: 'Registrar consumo',   color: AMBER, action: 'Registrar'           },
  }[mode]

  return (
    <Sheet onClose={onCancel}>
      <div style={{ padding: '8px 20px 36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(245,184,0,0.12)', border: '1px solid rgba(245,184,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ProdIcon iconKey={product.icon} size={24} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: FW_BOLD, color: LABEL }}>{meta.title}</h3>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: CAPTION }}>{product.name}</p>
          </div>
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, ...GLASS, borderRadius: 24, padding: '20px 24px', marginBottom: 14 }}>
          <button
            onClick={() => setQty(q => Math.max(1, q - 1))}
            style={{ width: 44, height: 44, borderRadius: 13, background: FILL2, color: SUBLABEL, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform .12s' }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(.94)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >−</button>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 46, fontWeight: FW_BOLD, color: meta.color, lineHeight: 1, letterSpacing: -2 }}>{qty}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: CAPTION }}>{product.unit}</p>
          </div>
          <button
            onClick={() => setQty(q => q + 1)}
            style={{ width: 44, height: 44, borderRadius: 13, background: FILL2, color: SUBLABEL, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform .12s' }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(.94)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >+</button>
        </div>

        <input
          placeholder="Observação (opcional)"
          value={note}
          onChange={e => setNote(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', padding: '13px 16px', borderRadius: 14, border: `1.5px solid ${BORDER}`, background: CARD, fontSize: 15, color: LABEL, outline: 'none', marginBottom: 14 }}
          onFocus={e => (e.target.style.borderColor = meta.color)}
          onBlur={e => (e.target.style.borderColor = BORDER)}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button onClick={onCancel} style={{ padding: '16px', borderRadius: 999, background: FILL2, color: SUBLABEL, fontSize: 15, fontWeight: FW_BOLD }}>
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(qty, note)}
            style={{ padding: '16px', borderRadius: 999, background: meta.color, color: INK_FG, fontSize: 15, fontWeight: FW_BOLD }}
          >
            {meta.action}
          </button>
        </div>
      </div>
    </Sheet>
  )
}

// ─── Detail Sheet ─────────────────────────────────────────────────────────────

function DetailSheet({ product, movements, onClose, onEdit, onDelete, onAdd, onRemove, onConsume }: {
  product: Product; movements: Movement[]
  onClose: () => void; onEdit: () => void; onDelete: () => void
  onAdd: () => void; onRemove: () => void; onConsume: () => void
}) {
  const s = stockStatus(product)
  const isCritical = s === 'critical' || s === 'empty'
  const history = movements.filter(m => m.productId === product.id).slice(0, 10)

  return (
    <Sheet onClose={onClose}>
      <div style={{ padding: '4px 20px 36px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(245,184,0,0.12)', border: '1px solid rgba(245,184,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ProdIcon iconKey={product.icon} size={28} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: FW_BOLD, color: LABEL, letterSpacing: -0.4 }}>{product.name}</h2>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: CAPTION }}>{product.category} · {product.unit}</p>
              <div style={{ marginTop: 6 }}><Pill status={s} /></div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 50, background: FILL2, color: CAPTION, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            {Ic.close}
          </button>
        </div>

        {/* Big numbers */}
        <div style={{ ...GLASS, borderRadius: 24, padding: '20px 20px 18px', marginBottom: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', textAlign: 'center', marginBottom: 16 }}>
            {[
              { label: 'Em estoque', val: product.stock,    bold: isCritical },
              { label: 'Utilizados',  val: product.used,    bold: false },
              { label: 'Mínimo',      val: product.minStock, bold: false },
              { label: 'Ideal',       val: idealStockOf(product), bold: false },
            ].map((x, i) => (
              <div key={x.label} style={{ borderRight: i < 3 ? `1px solid ${BORDER}` : 'none', paddingInline: 4 }}>
                <p style={{ margin: 0, fontSize: 28, fontWeight: FW_BOLD, color: x.bold ? '#D93025' : LABEL, lineHeight: 1, letterSpacing: -1 }}>{x.val}</p>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: CAPTION, fontWeight: FW_LIGHT }}>{x.label}</p>
              </div>
            ))}
          </div>
          <Bar product={product} height={6} />
          {isCritical && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12, background: 'rgba(255,106,106,0.1)', border: '1px solid rgba(255,106,106,0.25)', borderRadius: 10, padding: '8px 12px' }}>
              <span style={{ fontSize: 14 }}>⚠️</span>
              <p style={{ margin: 0, fontSize: 12.5, color: CORAL, fontWeight: FW_BOLD, lineHeight: 1.4 }}>
                {s === 'empty' ? 'Sem estoque — reposição urgente.' : 'Estoque baixo! Reposição necessária.'}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ ...GLASS, borderRadius: 24, padding: '16px', marginBottom: 10 }}>
          <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: FW_LIGHT, color: CAPTION, textTransform: 'uppercase', letterSpacing: 0.8 }}>Ações rápidas</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {[
              { label: 'Entrada',  action: onAdd,     cls: 'quick-act quick-act--in',  color: '#FFFBFA', bg: 'rgba(26,22,20,0.72)' },
              { label: 'Retirada', action: onRemove,  cls: 'quick-act quick-act--out', color: '#FFE8E6', bg: 'rgba(139,21,16,0.55)' },
              { label: 'Consumo',  action: onConsume, cls: 'quick-act quick-act--use', color: '#FFF6E8', bg: 'rgba(107,74,26,0.55)' },
            ].map(a => (
              <button
                key={a.label}
                className={a.cls}
                onClick={a.action}
                style={{ background: a.bg, borderRadius: 14, padding: '14px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, color: a.color }}
              >
                {a.label === 'Entrada' ? Ic.plus : a.label === 'Retirada' ? Ic.minus : Ic.trend}
                <span style={{ fontSize: 12, fontWeight: FW_BOLD }}>{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        {product.notes && (
          <div style={{ ...GLASS, borderRadius: 24, padding: '14px 16px', marginBottom: 10 }}>
            <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: FW_LIGHT, color: CAPTION, textTransform: 'uppercase', letterSpacing: 0.8 }}>Observações</p>
            <p style={{ margin: 0, fontSize: 14, color: SUBLABEL, lineHeight: 1.55 }}>{product.notes}</p>
          </div>
        )}

        {/* History */}
        <div style={{ ...GLASS, borderRadius: 24, padding: '16px', marginBottom: 16 }}>
          <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: FW_LIGHT, color: CAPTION, textTransform: 'uppercase', letterSpacing: 0.8 }}>Histórico</p>
          {history.length === 0
            ? <p style={{ margin: 0, fontSize: 14, color: CAPTION, textAlign: 'center', padding: '16px 0' }}>Nenhuma movimentação registrada</p>
            : history.map((m, i) => {
                const t = MOV_META[m.type]
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBlock: 9, borderTop: i > 0 ? `1px solid ${BORDER}` : 'none' }}>
                    <span style={{ fontSize: 11, fontWeight: FW_BOLD, color: '#FFFBFA', background: m.type === 'consumo' || m.type === 'saida' ? '#8B1510' : '#1A1614', padding: '4px 10px', borderRadius: 20, flexShrink: 0 }}>
                      {t.label}
                    </span>
                    <p style={{ margin: 0, flex: 1, fontSize: 13, color: SUBLABEL, fontWeight: FW_LIGHT }}>
                      {t.sign}{m.quantity} {product.unit}
                      {m.note && <span style={{ color: CAPTION, fontWeight: FW_LIGHT }}> · {m.note}</span>}
                    </p>
                    <span style={{ fontSize: 11, color: CAPTION, flexShrink: 0 }}>{relativeTime(m.date)}</span>
                  </div>
                )
              })
          }
        </div>

        {/* Edit / Delete */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
          <button
            onClick={onEdit}
            style={{ padding: '15px', borderRadius: 999, background: INK, color: INK_FG, fontSize: 15, fontWeight: FW_BOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {Ic.edit} Editar produto
          </button>
          <button
            onClick={onDelete}
            style={{ padding: '15px 18px', borderRadius: 16, background: 'rgba(255,59,48,0.09)', color: '#FF3B30', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {Ic.trash}
          </button>
        </div>
      </div>
    </Sheet>
  )
}

// ─── Product Form ─────────────────────────────────────────────────────────────

const UNITS: Unit[] = ['un','L','kg','cx','pct','rolos','pares','m']

function groupByCategory(list: Product[], order: string[]): { category: string; items: Product[] }[] {
  const buckets = new Map<string, Product[]>()
  for (const p of list) {
    const key = p.category || 'Outros'
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(p)
  }
  for (const items of buckets.values()) {
    items.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }
  const extras = [...buckets.keys()]
    .filter(k => !order.includes(k))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
  return [...order, ...extras]
    .filter(c => buckets.has(c))
    .map(category => ({ category, items: buckets.get(category)! }))
}

function ProductForm({ initial, onSave, onCancel, categories, onCreateCategory, onRenameCategory, onRemoveCategory }: {
  initial?: Partial<Product>
  onSave: (p: Partial<Product>) => void
  onCancel: () => void
  categories: string[]
  onCreateCategory: (name: string) => string | null
  onRenameCategory: (from: string, to: string) => string | null
  onRemoveCategory: (name: string) => string | null
}) {
  const [form, setForm] = useState<Partial<Product>>({
    name: '', category: categories[0] || 'Limpeza', unit: 'un', stock: 0, minStock: 5, idealStock: 5, icon: 'bottle', notes: '',
    ...initial,
  })
  const [catMode, setCatMode] = useState<'idle' | 'create' | 'edit'>('idle')
  const [catDraft, setCatDraft] = useState('')
  const [catMsg, setCatMsg] = useState('')

  const currentCat = form.category || categories[0] || 'Limpeza'
  const currentTint = catAccent(currentCat)

  const applyCatName = () => {
    const name = catDraft.trim()
    if (!name) { setCatMsg('Digite um nome.'); return }
    const result = catMode === 'create' ? onCreateCategory(name) : onRenameCategory(currentCat, name)
    if (!result) { setCatMsg('Essa categoria já existe.'); return }
    setForm(f => ({ ...f, category: result }))
    setCatMode('idle')
    setCatDraft('')
    setCatMsg('')
  }

  const removeCurrent = () => {
    if (categories.length <= 1) { setCatMsg('Mantenha ao menos uma categoria.'); return }
    const fallback = onRemoveCategory(currentCat)
    if (!fallback) { setCatMsg('Não foi possível retirar.'); return }
    setForm(f => ({ ...f, category: fallback }))
    setCatMode('idle')
    setCatMsg('')
  }

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '8px 11px', borderRadius: 11,
    border: '1.5px solid rgba(255,255,255,0.42)', background: 'rgba(10, 16, 28, 0.92)', fontSize: 14, color: '#FFFBFA', outline: 'none', colorScheme: 'dark',
  }

  const Field = ({ label, children, tight }: { label: string; children: React.ReactNode; tight?: boolean }) => (
    <div style={{ marginBottom: tight ? 0 : 8 }}>
      <label style={{ display: 'block', fontSize: 10, fontWeight: FW_BOLD, color: '#FFFBFA', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</label>
      {children}
    </div>
  )

  const miniBtn: React.CSSProperties = {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    padding: '7px 6px', borderRadius: 10, border: `1px solid ${BORDER}`, background: 'rgba(8,16,36,0.55)',
    color: LABEL, fontSize: 11, fontWeight: FW_BOLD, cursor: 'pointer',
  }

  return (
    <Sheet onClose={onCancel} fit>
      <div className="product-form-fit">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: FW_BOLD, color: LABEL }}>{initial?.id ? 'Editar produto' : 'Novo produto'}</h2>
          <button onClick={onCancel} style={{ width: 28, height: 28, borderRadius: 50, background: FILL2, color: CAPTION, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {Ic.close}
          </button>
        </div>

        <div style={{ ...GLASS, background: 'rgba(12, 18, 32, 0.88)', borderRadius: 18, padding: '12px 12px 10px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr', gap: 10 }}>
            <Field label="Nome" tight>
              <input className="form-field" style={inp} placeholder="Ex: Álcool 70%" value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                onFocus={e => (e.target.style.borderColor = '#F0D5C4')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.42)')} />
            </Field>
            <Field label="Unidade" tight>
              <select className="form-field" style={{ ...inp, appearance: 'none' }} value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value as Unit }))}>
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </Field>
          </div>

          <Field label={`Categoria · ${currentCat}`} tight>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 12px', marginBottom: 10 }}>
              {categories.map(c => {
                const on = c === currentCat
                const tint = catAccent(c)
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { setForm(f => ({ ...f, category: c })); setCatMode('idle'); setCatMsg('') }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 14,
                      fontSize: 13, fontWeight: on ? FW_BOLD : FW_NORMAL, textAlign: 'left',
                      background: on ? 'rgba(8,16,36,0.92)' : 'rgba(8,16,36,0.35)',
                      color: LABEL, border: `1.5px solid ${on ? tint : BORDER}`, cursor: 'pointer',
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: tint, flexShrink: 0 }} />
                    {c}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" style={miniBtn} onClick={() => { setCatMode('create'); setCatDraft(''); setCatMsg('') }}>
                {Ic.plus} Criar
              </button>
              <button type="button" style={miniBtn} onClick={() => { setCatMode('edit'); setCatDraft(currentCat); setCatMsg('') }}>
                {Ic.edit} Editar
              </button>
              <button type="button" style={{ ...miniBtn, color: CORAL }} onClick={removeCurrent}>
                {Ic.trash} Retirar
              </button>
            </div>
            {catMode !== 'idle' && (
              <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  className="form-field"
                  autoFocus
                  placeholder={catMode === 'create' ? 'Nome da nova categoria' : 'Novo nome'}
                  value={catDraft}
                  onChange={e => setCatDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') applyCatName(); if (e.key === 'Escape') setCatMode('idle') }}
                  style={{ ...inp, flex: 1 }}
                />
                <button type="button" onClick={applyCatName} style={{ ...miniBtn, flex: 'none', padding: '8px 12px', background: INK, color: INK_FG, border: 'none' }}>OK</button>
              </div>
            )}
            {catMsg && <p style={{ margin: '8px 0 0', fontSize: 11, color: CORAL }}>{catMsg}</p>}
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Field label="Qtd." tight>
              <input className="form-field" type="number" min="0" style={inp} value={form.stock ?? 0} onChange={e => setForm(f => ({ ...f, stock: +e.target.value }))}
                onFocus={e => (e.target.style.borderColor = '#F0D5C4')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.42)')} />
            </Field>
            <Field label="Mínimo" tight>
              <input className="form-field" type="number" min="0" style={inp} value={form.minStock ?? 5} onChange={e => setForm(f => ({ ...f, minStock: +e.target.value }))}
                onFocus={e => (e.target.style.borderColor = '#F0D5C4')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.42)')} />
            </Field>
            <Field label="Ideal" tight>
              <input className="form-field" type="number" min="0" style={inp} value={form.idealStock ?? form.minStock ?? 5} onChange={e => setForm(f => ({ ...f, idealStock: +e.target.value }))}
                onFocus={e => (e.target.style.borderColor = '#F0D5C4')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.42)')} />
            </Field>
          </div>

          <Field label="Observações" tight>
            <input className="form-field" style={inp} placeholder="Marca, fornecedor…" value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              onFocus={e => (e.target.style.borderColor = '#F0D5C4')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.42)')} />
          </Field>
        </div>

        <button
          onClick={() => form.name?.trim() && onSave(form)}
          disabled={!form.name?.trim()}
          style={{ flexShrink: 0, width: '100%', marginTop: 8, padding: '12px', borderRadius: 999, background: form.name?.trim() ? INK : FILL2, color: form.name?.trim() ? INK_FG : CAPTION, fontSize: 15, fontWeight: FW_BOLD }}
        >
          {initial?.id ? 'Salvar alterações' : 'Adicionar produto'}
        </button>
      </div>
    </Sheet>
  )
}

// ─── Estoque Screen ───────────────────────────────────────────────────────────

function EstoqueScreen({ products, movements, onUpdate, openNewKey = 0, categories, onCreateCategory, onRenameCategory, onRemoveCategory, onOverlayChange }: {
  products: Product[]
  movements: Movement[]
  onUpdate: (p: Product[], m: Movement[]) => void
  openNewKey?: number
  categories: string[]
  onCreateCategory: (name: string) => string | null
  onRenameCategory: (from: string, to: string) => string | null
  onRemoveCategory: (name: string) => string | null
  onOverlayChange?: (open: boolean) => void
}) {
  const [search, setSearch]     = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchWrapRef = useRef<HTMLDivElement>(null)
  const searchBtnRef = useRef<HTMLButtonElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const filter: FilterType = 'todos'
  const [categoryFilter, setCategoryFilter] = useState<'todos' | Category>('todos')
  const [catsOpen, setCatsOpen] = useState(false)
  const catWrapRef = useRef<HTMLDivElement>(null)
  const [reportMonth, setReportMonth] = useState(new Date().getMonth())
  const [monthsOpen, setMonthsOpen] = useState(false)
  const monthWrapRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<Product | null>(null)
  const [editing, setEditing]   = useState<Product | 'new' | undefined>()

  useEffect(() => {
    onOverlayChange?.(!!selected || editing !== undefined)
    return () => onOverlayChange?.(false)
  }, [selected, editing, onOverlayChange])

  useEffect(() => {
    if (openNewKey) setEditing('new')
  }, [openNewKey])

  useEffect(() => {
    if (!monthsOpen && !catsOpen && !searchOpen) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (monthsOpen && !monthWrapRef.current?.contains(t)) setMonthsOpen(false)
      if (catsOpen && !catWrapRef.current?.contains(t)) setCatsOpen(false)
      if (searchOpen && !searchWrapRef.current?.contains(t) && !searchBtnRef.current?.contains(t) && !search.trim()) setSearchOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [monthsOpen, catsOpen, searchOpen, search])

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  useEffect(() => {
    if (categoryFilter !== 'todos' && !categories.includes(categoryFilter)) setCategoryFilter('todos')
  }, [categories, categoryFilter])

  const filtered = useMemo(() => products.filter(p => {
    const ms = p.name.toLowerCase().includes(search.toLowerCase())
    const s = stockStatus(p)
    const mf = filter === 'todos' || (filter === 'normal' && s === 'ok') ||
               (filter === 'atencao' && s === 'low') || (filter === 'critico' && s === 'critical') ||
               (filter === 'zerado' && s === 'empty')
    const cf = categoryFilter === 'todos' || p.category === categoryFilter
    return ms && mf && cf
  }), [products, search, filter, categoryFilter])

  const grouped = useMemo(() => groupByCategory(filtered, categories), [filtered, categories])

  const criticalCount = products.filter(p => stockStatus(p) === 'critical' || stockStatus(p) === 'empty').length
  const atIdealCount = products.filter(p => p.stock >= idealStockOf(p)).length

  const doAdjust = (pr: Product, mode: AdjustMode) => {
    const mv: Movement = {
      id: uid(), productId: pr.id, quantity: 1, note: '', date: new Date(),
      type: mode === 'add' ? 'entrada' : 'consumo',
    }
    const updated = products.map(p => p.id !== pr.id ? p : {
      ...p,
      stock: mode === 'add' ? p.stock + 1 : Math.max(0, p.stock - 1),
      used:  mode !== 'add' ? p.used + 1 : p.used,
    })
    onUpdate(updated, [mv, ...movements])
    if (selected?.id === pr.id) setSelected(updated.find(p => p.id === pr.id) ?? null)
  }

  const doSave = (data: Partial<Product>) => {
    if (editing === 'new') {
      const p: Product = { id: uid(), name: data.name||'', category: data.category|| categories[0] || 'Limpeza', unit: data.unit||'un', stock: data.stock||0, minStock: data.minStock||5, idealStock: data.idealStock ?? data.minStock ?? 5, used: 0, icon: data.icon||'bottle', notes: data.notes||'' }
      onUpdate([...products, p], movements)
    } else if (editing && typeof editing === 'object') {
      onUpdate(products.map(p => p.id === (editing as Product).id ? { ...p, ...data } : p), movements)
    }
    setEditing(undefined)
  }

  const doDelete = (p: Product) => {
    onUpdate(products.filter(x => x.id !== p.id), movements.filter(m => m.productId !== p.id))
    setSelected(null)
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 118px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 8px 6px', gap: 4 }}>
        <RingStat
          label="Produtos"
          display={String(products.length)}
          color="#4ECDC4"
          pct={1}
          icon={Ic.box}
          title="Quantidade de produtos cadastrados"
        />
        <RingStat
          label="Críticos"
          display={String(criticalCount)}
          color="#E88984"
          pct={products.length ? criticalCount / products.length : 0}
          icon={Ic.warn}
          title="Produtos abaixo do mínimo ou zerados"
        />
        <RingStat
          label="no ideal"
          display={String(atIdealCount)}
          color="#5BD38A"
          pct={products.length ? atIdealCount / products.length : 0}
          icon={Ic.shield}
          title="Produtos com estoque igual ou acima do ideal"
        />
      </div>
      <p style={{ margin: '0 12px 14px', fontSize: 11, color: 'rgba(255,250,246,0.78)', textAlign: 'center', fontWeight: FW_NORMAL, lineHeight: 1.35 }}>
        cadastrados · abaixo do mínimo · estoque ≥ ideal
      </p>

      {/* Filter chips — retractable */}
      <div className="estoque-toolbar">
        <div ref={catWrapRef} style={{ position: 'relative', flexShrink: 0, zIndex: 51 }}>
          <button
            className="toolbar-chip"
            onClick={() => { setCatsOpen(o => !o); setMonthsOpen(false) }}
          >
            {Ic.funnel}
            {categoryFilter === 'todos' ? 'Todos' : categoryFilter}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: catsOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {catsOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0,
                zIndex: 52,
                width: 228,
                padding: 10,
                ...GLASS,
                borderRadius: 20,
                animation: 'fadeIn .16s ease',
              }}
            >
              <p style={{ margin: '2px 6px 10px', fontSize: 11, fontWeight: FW_LIGHT, color: CAPTION, letterSpacing: 0.6, textTransform: 'uppercase' }}>Categoria</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(['todos', ...categories] as const).map(c => {
                  const on = categoryFilter === c
                  const label = c === 'todos' ? 'Todos' : c
                  const tint = c === 'todos' ? '#FFFBFA' : catAccent(c)
                  return (
                    <button
                      key={c}
                      onClick={() => { setCategoryFilter(c); setCatsOpen(false) }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 12px',
                        borderRadius: 12,
                        fontSize: 13,
                        fontWeight: on ? FW_BOLD : FW_NORMAL,
                        background: on ? INK : 'transparent',
                        color: on ? INK_FG : LABEL,
                        border: on ? 'none' : `1px solid ${BORDER}`,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: 99, background: tint, flexShrink: 0 }} />
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        <div ref={monthWrapRef} style={{ position: 'relative', flexShrink: 0, zIndex: 50 }}>
          <button
            className="toolbar-chip"
            onClick={() => { setMonthsOpen(o => !o); setCatsOpen(false) }}
          >
            {Ic.calendar}
            {MONTHS[reportMonth].short}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: monthsOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {monthsOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0,
                zIndex: 50,
                width: 228,
                padding: 10,
                ...GLASS,
                borderRadius: 20,
                animation: 'fadeIn .16s ease',
              }}
            >
              <p style={{ margin: '2px 6px 10px', fontSize: 11, fontWeight: FW_LIGHT, color: CAPTION, letterSpacing: 0.6, textTransform: 'uppercase' }}>Mês do relatório</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {MONTHS.map(m => {
                  const on = m.i === reportMonth
                  return (
                    <button
                      key={m.i}
                      onClick={() => { setReportMonth(m.i); setMonthsOpen(false) }}
                      style={{
                        padding: '10px 0',
                        borderRadius: 12,
                        fontSize: 13,
                        fontWeight: on ? FW_BOLD : FW_NORMAL,
                        background: on ? INK : 'transparent',
                        color: on ? INK_FG : LABEL,
                        border: on ? 'none' : `1px solid ${BORDER}`,
                        cursor: 'pointer',
                      }}
                    >
                      {m.short}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        <span className="estoque-toolbar-spacer" />
        <button
          className="toolbar-chip toolbar-chip--icon"
          aria-label="Baixar PDF"
          title="Baixar PDF"
          onClick={() => generatePDF(filtered, filter, movements, reportMonth)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
        <button
          ref={searchBtnRef}
          className={`toolbar-chip toolbar-chip--icon${searchOpen || search ? ' toolbar-chip--on' : ''}`}
          aria-label="Buscar produto"
          aria-expanded={searchOpen}
          onClick={() => {
            setSearchOpen(o => !o)
            setCatsOpen(false)
            setMonthsOpen(false)
          }}
        >
          {Ic.search}
        </button>
      </div>

      {searchOpen && (
        <div ref={searchWrapRef} style={{ padding: '0 16px 12px' }}>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: CAPTION, pointerEvents: 'none' }}>
              {Ic.search}
            </div>
            <input
              ref={searchInputRef}
              placeholder="Buscar produto…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setSearchOpen(false); if (!search.trim()) setSearch('') } }}
              style={{ width: '100%', boxSizing: 'border-box', padding: '11px 40px 11px 40px', borderRadius: 999, border: `1px solid ${BORDER}`, background: CARD, backdropFilter: 'blur(24px)', fontSize: 15, color: LABEL, outline: 'none', boxShadow: SHADOW }}
            />
            <button
              onClick={() => { setSearch(''); setSearchOpen(false) }}
              aria-label="Fechar busca"
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: CAPTION, display: 'flex', alignItems: 'center' }}
            >
              {Ic.close}
            </button>
          </div>
        </div>
      )}

      {/* Product list — individual cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '52px 20px', color: CAPTION, ...GLASS, borderRadius: 24 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: FW_LIGHT }}>Nenhum produto encontrado</p>
          </div>
        ) : (
          grouped.map(({ category, items }) => {
            const tint = catAccent(category)
            return (
              <div key={category} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="cat-section-head">
                  <span className="cat-section-dot" style={{ background: tint }} />
                  <span className="cat-section-name">{category}</span>
                  <span className="cat-section-count">{items.length}</span>
                </div>
                {items.map(p => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    onSelect={() => setSelected(p)}
                    onAdd={() => doAdjust(p, 'add')}
                    onRemove={() => doAdjust(p, 'remove')}
                  />
                ))}
              </div>
            )
          })
        )}
      </div>

      {/* Modals */}
      {selected && (
        <DetailSheet
          product={selected} movements={movements}
          onClose={() => setSelected(null)}
          onEdit={() => { setEditing(selected); setSelected(null) }}
          onDelete={() => doDelete(selected)}
          onAdd={() => doAdjust(selected, 'add')}
          onRemove={() => doAdjust(selected, 'remove')}
          onConsume={() => doAdjust(selected, 'consume')}
        />
      )}
      {editing !== undefined && (
        <ProductForm
          initial={editing !== 'new' ? (editing as Product) : undefined}
          onSave={doSave}
          onCancel={() => setEditing(undefined)}
          categories={categories}
          onCreateCategory={onCreateCategory}
          onRenameCategory={onRenameCategory}
          onRemoveCategory={onRemoveCategory}
        />
      )}
    </div>
  )
}

// ─── Movimentações Screen ─────────────────────────────────────────────────────

function MovimentacoesScreen({ products, movements }: { products: Product[]; movements: Movement[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, Movement[]>()
    movements.forEach(m => {
      const d = m.date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
      if (!map.has(d)) map.set(d, [])
      map.get(d)!.push(m)
    })
    return map
  }, [movements])

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 118px' }}>
      {movements.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: CAPTION }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <p style={{ margin: 0, fontSize: 16, fontWeight: FW_LIGHT }}>Nenhuma movimentação</p>
        </div>
      ) : (
        Array.from(grouped.entries()).map(([date, items]) => (
          <div key={date} style={{ marginBottom: 22 }}>
            <p style={{ margin: '0 4px 8px', fontSize: 11, fontWeight: FW_LIGHT, color: CAPTION, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              {date}
            </p>
            <div style={{ ...GLASS, borderRadius: 24, overflow: 'hidden' }}>
              {items.map((m, i) => {
                const pr = products.find(p => p.id === m.productId)
                const t = MOV_META[m.type]
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderTop: i > 0 ? `1px solid ${BORDER}` : 'none' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(245,184,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <ProdIcon iconKey={pr?.icon ?? 'bottle'} size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: FW_BOLD, color: LABEL, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {pr?.name ?? 'Produto removido'}
                      </p>
                      {m.note && <p style={{ margin: '1px 0 0', fontSize: 12, color: CAPTION }}>{m.note}</p>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: FW_BOLD, color: t.color }}>
                        {t.sign}{m.quantity} {pr?.unit}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: CAPTION }}>{relativeTime(m.date)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ─── Alertas Screen ───────────────────────────────────────────────────────────

function AlertasScreen({ products }: { products: Product[] }) {
  const critical = products.filter(p => { const s = stockStatus(p); return s === 'critical' || s === 'empty' })
  const low      = products.filter(p => stockStatus(p) === 'low')

  if (critical.length === 0 && low.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ fontSize: 64, marginBottom: 18 }}>✅</div>
        <p className="display-title" style={{ margin: 0, fontSize: 40, color: LABEL }}>Tudo em ordem</p>
        <p style={{ margin: '8px 0 0', fontSize: 15, color: CAPTION, textAlign: 'center' }}>Nenhum produto com estoque crítico ou próximo do mínimo.</p>
      </div>
    )
  }

  const Section = ({ title, color, items, s }: { title: string; color: string; items: Product[]; s: ReturnType<typeof stockStatus> }) => (
    <div style={{ marginBottom: 22 }}>
      <p style={{ margin: '0 4px 8px', fontSize: 11, fontWeight: FW_LIGHT, color, letterSpacing: '0.22em', textTransform: 'lowercase' }}>{title} · {items.length}</p>
      <div style={{ ...GLASS, borderRadius: 24, overflow: 'hidden' }}>
        {items.map((p, i) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderTop: i > 0 ? `1px solid ${BORDER}` : 'none' }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(245,184,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ProdIcon iconKey={p.icon} size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: FW_BOLD, color: LABEL }}>{p.name}</p>
              <p style={{ margin: '2px 0 4px', fontSize: 12, color: CAPTION }}>
                {p.stock} {p.unit} restante{p.stock !== 1 ? 's' : ''} · Mínimo: {p.minStock} {p.unit}
              </p>
              <Bar product={p} height={4} />
            </div>
            <Pill status={s} />
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 118px' }}>
      {critical.length > 0 && <Section title="Estoque crítico" color="#C0251B" items={critical} s={critical[0].stock === 0 ? 'empty' : 'critical'} />}
      {low.length > 0      && <Section title="Atenção" color="#99600A" items={low} s="low" />}
    </div>
  )
}

// ─── Ajustes Screen ───────────────────────────────────────────────────────────

function AjustesScreen({ products, isDark, setDark, onRestoreMonthList, onFillIdeal, onExport, onImportText }: {
  products: Product[]
  isDark: boolean
  setDark: (v: boolean) => void
  onRestoreMonthList: () => void
  onFillIdeal: () => void
  onExport: () => void
  onImportText: (text: string, fileName: string) => string
}) {
  const [note, setNote] = useState('')
  const importRef = useRef<HTMLInputElement>(null)
  const rows = [
    { label: 'Total de produtos',   value: `${products.length}` },
    { label: 'Itens com alerta',    value: `${products.filter(p => stockStatus(p) !== 'ok').length}` },
    { label: 'Itens sem estoque',   value: `${products.filter(p => stockStatus(p) === 'empty').length}` },
    { label: 'Unidades em estoque', value: `${products.reduce((a, p) => a + p.stock, 0)}` },
  ]

  const Toggle = () => (
    <button onClick={() => setDark(!isDark)}
      style={{ width: 50, height: 30, borderRadius: 15, background: isDark ? INK : 'rgba(120,120,128,0.28)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}
    >
      <div style={{ position: 'absolute', top: 3, left: isDark ? 23 : 3, width: 24, height: 24, borderRadius: 12, background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.22)', transition: 'left .2s cubic-bezier(.34,1.4,.64,1)' }} />
    </button>
  )

  const Action = ({ title, onClick }: { title: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      style={{
        flex: 1, minWidth: 0, padding: '12px 10px', background: 'transparent', border: 'none',
        cursor: 'pointer', fontSize: 13, fontWeight: FW_BOLD, color: LABEL, lineHeight: 1.25, textAlign: 'center',
      }}
    >
      {title}
    </button>
  )

  const ActionRow = ({ children }: { children: React.ReactNode }) => (
    <div style={{ ...GLASS, borderRadius: 24, overflow: 'hidden', display: 'flex', alignItems: 'stretch', marginBottom: 22 }}>
      {children}
    </div>
  )

  const VLine = () => <div style={{ width: 1, background: BORDER, flexShrink: 0, margin: '10px 0' }} />

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 118px' }}>
      <p style={{ margin: '0 4px 8px', fontSize: 11, fontWeight: FW_LIGHT, color: CAPTION, textTransform: 'uppercase', letterSpacing: 0.8 }}>Resumo</p>
      <div style={{ ...GLASS, borderRadius: 24, overflow: 'hidden', marginBottom: 22 }}>
        {rows.map((r, i) => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderTop: i > 0 ? `1px solid ${BORDER}` : 'none' }}>
            <span style={{ fontSize: 15, color: LABEL }}>{r.label}</span>
            <span style={{ fontSize: 15, fontWeight: FW_BOLD, color: BLUE }}>{r.value}</span>
          </div>
        ))}
      </div>

      <p style={{ margin: '0 4px 8px', fontSize: 11, fontWeight: FW_LIGHT, color: CAPTION, textTransform: 'uppercase', letterSpacing: 0.8 }}>Preferências</p>
      <div style={{ ...GLASS, borderRadius: 24, overflow: 'hidden', marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
          <div>
            <p style={{ margin: 0, fontSize: 15, color: LABEL, fontWeight: FW_NORMAL }}>{isDark ? 'Modo escuro' : 'Modo claro'}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: CAPTION }}>{isDark ? 'Tema escuro ativo' : 'Tema claro ativo'}</p>
          </div>
          <Toggle />
        </div>
      </div>

      <p style={{ margin: '0 4px 8px', fontSize: 11, fontWeight: FW_LIGHT, color: CAPTION, textTransform: 'uppercase', letterSpacing: 0.8 }}>Início do mês</p>
      <ActionRow>
        <Action
          title="Voltar à lista do mês"
          onClick={() => {
            if (!confirm('Restaurar a lista original do mês? Alterações no cadastro serão substituídas pela configuração salva no app.')) return
            onRestoreMonthList()
            setNote('Lista do mês restaurada.')
          }}
        />
        <VLine />
        <Action
          title="Estoque cheio"
          onClick={() => {
            if (!confirm('Preencher o estoque com o ideal e zerar o uso de todos os produtos?')) return
            onFillIdeal()
            setNote('Estoque preenchido no ideal. Uso zerado.')
          }}
        />
      </ActionRow>

      <p style={{ margin: '0 4px 8px', fontSize: 11, fontWeight: FW_LIGHT, color: CAPTION, textTransform: 'uppercase', letterSpacing: 0.8 }}>Exportar / importar</p>
      <ActionRow>
        <Action
          title="Exportar PDF"
          onClick={() => {
            onExport()
            setNote('PDF e cópia .json baixados. Guarde o .json para sincronizar.')
          }}
        />
        <VLine />
        <Action
          title="Importar"
          onClick={() => importRef.current?.click()}
        />
      </ActionRow>
      <input
        ref={importRef}
        type="file"
        accept=".json,application/json,.txt,.pdf,application/pdf"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          file.text().then(text => setNote(onImportText(text, file.name))).catch(() => setNote('Não foi possível ler o arquivo.'))
        }}
      />
      {note && <p style={{ margin: '0 4px', fontSize: 13, color: '#4ECDC4' }}>{note}</p>}
    </div>
  )
}

const BACKUP_KIND = 'journey-estoque-backup-v1'

function downloadJsonBackup(products: Product[], movements: Movement[], categories: string[], dark: boolean) {
  const payload = {
    kind: BACKUP_KIND,
    version: 1,
    savedAt: new Date().toISOString(),
    products,
    movements,
    categories,
    dark,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `epj-copia-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function parseBackupFile(text: string, fileName: string): { products: Product[]; movements: Movement[]; categories?: string[]; dark?: boolean } | { error: string } {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.pdf') || text.startsWith('%PDF')) {
    return { error: 'O PDF é só para impressão. Para sincronizar, escolha o arquivo .json baixado junto na exportação.' }
  }
  try {
    const parsed = JSON.parse(text) as {
      kind?: string
      products?: Product[]
      movements?: Array<Movement & { date: string | Date }>
      categories?: string[]
      dark?: boolean
    }
    if (!Array.isArray(parsed.products) || parsed.products.length === 0) {
      return { error: 'Arquivo sem produtos. Use o .json gerado em Exportar PDF.' }
    }
    const products = parsed.products.filter(p => p && typeof p.id === 'string' && typeof p.name === 'string').map(p => ({
      ...p,
      stock: Number(p.stock) || 0,
      minStock: Number(p.minStock) || 0,
      used: Number(p.used) || 0,
    }))
    if (!products.length) return { error: 'Nenhum produto válido neste arquivo.' }
    const movements = (Array.isArray(parsed.movements) ? parsed.movements : []).map(m => ({
      ...m,
      date: new Date(m.date),
    }))
    return {
      products,
      movements,
      categories: parsed.categories,
      dark: parsed.dark,
    }
  } catch {
    return { error: 'Arquivo inválido. Importe o .json da exportação, não o PDF.' }
  }
}

// ─── Root App ─────────────────────────────────────────────────────────────────

const NAV: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'estoque',       label: 'Estoque',    icon: Ic.box  },
  { id: 'movimentacoes', label: 'Histórico',  icon: Ic.list },
  { id: 'alertas',       label: 'Alertas',    icon: Ic.bell },
  { id: 'ajustes',       label: 'Ajustes',    icon: Ic.gear },
]

const PAGE_TITLE: Record<Tab, string> = {
  estoque: 'Estoque', movimentacoes: 'Movimentações', alertas: 'Alertas', ajustes: 'Ajustes',
}
const PAGE_KICKER: Record<Tab, string> = {
  estoque: 'inventário', movimentacoes: 'histórico', alertas: 'avisos', ajustes: 'preferências',
}

function generatePDF(products: Product[], filter: FilterType = 'todos', movements: Movement[] = [], reportMonth = new Date().getMonth()) {
  const now = new Date()
  const year = now.getFullYear()
  const monthMeta = MONTHS[reportMonth]
  const stamp = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const total     = products.length
  const critical  = products.filter(p => stockStatus(p) === 'critical' || stockStatus(p) === 'empty').length
  const low       = products.filter(p => stockStatus(p) === 'low').length
  const toBuyList = products.filter(p => qtyToBuy(p) > 0).sort((a, b) => qtyToBuy(b) - qtyToBuy(a))
  const monthMoves = movements.filter(m => {
    const d = m.date instanceof Date ? m.date : new Date(m.date)
    return d.getMonth() === reportMonth && d.getFullYear() === year
  })
  const usedInMonth = (productId: string) =>
    monthMoves.filter(m => m.productId === productId && m.type !== 'entrada' && m.type !== 'ajuste')
      .reduce((a, m) => a + m.quantity, 0)
  const monthTotalUsed = monthMoves.filter(m => m.type !== 'entrada' && m.type !== 'ajuste').reduce((a, m) => a + m.quantity, 0)
  const filterLabel: Record<FilterType, string> = {
    todos: 'Todos', normal: 'Normal', atencao: 'Atenção', critico: 'Crítico', zerado: 'Zerado',
  }
  const statusLabel: Record<ReturnType<typeof stockStatus>, string> = {
    ok: 'Normal', low: 'Atenção', critical: 'Crítico', empty: 'Zerado',
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Relatório de Estoque', 14, 16)
  doc.setFontSize(11)
  doc.text('Colégio Journey', 14, 22)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(90)
  doc.text(`Competência: ${monthMeta.full} ${year}`, 14, 28)
  doc.text(`Gerado em ${stamp}  ·  Filtro: ${filterLabel[filter]}`, 14, 33)
  doc.setTextColor(20)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(`${total} produtos`, pageW - 14, 16, { align: 'right' })

  const cards = [
    { label: 'Total', value: String(total) },
    { label: 'Alertas', value: String(critical) },
    { label: 'Em atenção', value: String(low) },
    { label: `Uso em ${monthMeta.short}`, value: String(monthTotalUsed) },
  ]
  const gap = 4
  const cardW = (pageW - 28 - gap) / 2
  cards.forEach((c, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = 14 + col * (cardW + gap)
    const y = 38 + row * 18
    doc.setDrawColor(220)
    doc.roundedRect(x, y, cardW, 15, 2, 2)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(20)
    doc.text(c.value, x + 4, y + 7)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(100)
    doc.text(c.label, x + 4, y + 12)
  })

  autoTable(doc, {
    startY: 78,
    head: [['Produto', 'Estoque', 'Ideal', `Uso ${monthMeta.short}`, 'Status']],
    body: products.map(p => {
      const s = stockStatus(p)
      return [
        p.name,
        `${p.stock} ${p.unit}`,
        `${idealStockOf(p)} ${p.unit}`,
        `${usedInMonth(p.id)} ${p.unit}`,
        statusLabel[s],
      ]
    }),
    styles: { fontSize: 8.5, cellPadding: 1.8 },
    headStyles: { fillColor: [26, 22, 20], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 246, 244] },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const v = String(data.cell.raw)
        if (v === 'Crítico' || v === 'Zerado') data.cell.styles.textColor = [192, 37, 27]
        else if (v === 'Atenção') data.cell.styles.textColor = [154, 87, 0]
        else data.cell.styles.textColor = [26, 127, 55]
      }
    },
    margin: { left: 14, right: 14 },
  })

  doc.addPage()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(20)
  doc.text('Deve comprar', 14, 16)
  doc.setFontSize(11)
  doc.text('Colégio Journey', 14, 22)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(90)
  doc.text(`Competência: ${monthMeta.full} ${year}`, 14, 28)
  doc.text('Quantidade para completar o estoque ideal (sempre cheio).', 14, 33)
  doc.setTextColor(20)

  if (toBuyList.length === 0) {
    doc.setFontSize(10)
    doc.text('Nenhum item abaixo do estoque ideal.', 14, 42)
  } else {
    autoTable(doc, {
      startY: 40,
      head: [['Produto', 'Atual', 'Ideal', 'Deve comprar']],
      body: toBuyList.map(p => [
        p.name,
        `${p.stock} ${p.unit}`,
        `${idealStockOf(p)} ${p.unit}`,
        `${qtyToBuy(p)} ${p.unit}`,
      ]),
      styles: { fontSize: 8.5, cellPadding: 1.8 },
      headStyles: { fillColor: [139, 21, 16], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [252, 242, 240] },
      columnStyles: { 3: { fontStyle: 'bold', textColor: [139, 21, 16] } },
      margin: { left: 14, right: 14 },
    })
  }

  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(140)
    doc.text(`Controle de Estoque Journey — ${monthMeta.full} ${year}  ·  página ${i} de ${pages}`, 14, doc.internal.pageSize.getHeight() - 8)
  }

  const mm = String(reportMonth + 1).padStart(2, '0')
  doc.save(`relatorio-estoque-journey-${year}-${mm}.pdf`)
}

const persisted = loadState<Product, Movement>()

export default function App() {
  const [tab, setTab]           = useState<Tab>('estoque')
  const [products, setProducts] = useState<Product[]>(persisted?.products ?? initialProducts)
  const [movements, setMovements] = useState<Movement[]>(persisted?.movements ?? initialMovements)
  const [categories, setCategories] = useState<string[]>(() =>
    uniqueCategories([...(persisted?.categories ?? DEFAULT_CATEGORIES), ...(persisted?.products ?? initialProducts).map(p => p.category)])
  )
  const [dark, setDark]         = useState(persisted?.dark ?? true)
  const [openNewKey, setOpenNewKey] = useState(0)
  const [hideNav, setHideNav] = useState(false)

  const openNewProduct = () => {
    setTab('estoque')
    setOpenNewKey(k => k + 1)
  }

  useEffect(() => {
    if (dark) {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', 'light')
    }
  }, [dark])

  useEffect(() => {
    saveState({ products, movements, dark, categories })
  }, [products, movements, dark, categories])

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (isStandalone) return

    type InstallEvt = Event & { prompt: () => Promise<void> }
    let installEvt: InstallEvt | null = null

    const enterFullscreen = () => {
      const el = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void> | void
      }
      if (document.fullscreenElement) return
      if (el.requestFullscreen) {
        el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {})
        return
      }
      try { el.webkitRequestFullscreen?.() } catch { /* iOS Safari may block */ }
    }

    const onFirstGesture = () => {
      enterFullscreen()
      installEvt?.prompt().catch(() => {})
    }

    const onInstall = (e: Event) => {
      e.preventDefault()
      installEvt = e as InstallEvt
    }

    window.addEventListener('beforeinstallprompt', onInstall)
    window.addEventListener('pointerdown', onFirstGesture, { once: true, passive: true })
    return () => {
      window.removeEventListener('beforeinstallprompt', onInstall)
      window.removeEventListener('pointerdown', onFirstGesture)
    }
  }, [])

  const alertCount = products.filter(p => { const s = stockStatus(p); return s === 'critical' || s === 'empty' }).length

  const handleUpdate = (p: Product[], m: Movement[]) => { setProducts(p); setMovements(m) }

  const onCreateCategory = (name: string): string | null => {
    const t = name.trim()
    if (!t) return null
    if (categories.some(c => c.toLocaleLowerCase('pt-BR') === t.toLocaleLowerCase('pt-BR'))) return null
    setCategories(cs => [...cs, t])
    return t
  }

  const onRenameCategory = (from: string, to: string): string | null => {
    const t = to.trim()
    if (!t) return null
    const clash = categories.some(c => c !== from && c.toLocaleLowerCase('pt-BR') === t.toLocaleLowerCase('pt-BR'))
    if (clash) return null
    setCategories(cs => cs.map(c => c === from ? t : c))
    setProducts(ps => ps.map(p => p.category === from ? { ...p, category: t } : p))
    return t
  }

  const onRemoveCategory = (name: string): string | null => {
    if (categories.length <= 1) return null
    const rest = categories.filter(c => c !== name)
    const fallback = rest[0]
    setCategories(rest)
    setProducts(ps => ps.map(p => p.category === name ? { ...p, category: fallback } : p))
    return fallback
  }

  return (
    <div style={{ display: 'flex', height: '100dvh', background: 'transparent', fontFamily: 'var(--font-sans)' }}>

      {/* Sidebar — desktop only via CSS */}
      <nav className="sidebar-desktop" style={{ flexDirection: 'column', width: 232, flexShrink: 0, height: '100%', background: SIDEBAR, borderRight: `1px solid ${BORDER}`, padding: '32px 14px 24px' }}>
        <div style={{ padding: '0 10px 32px' }}>
          <img
            src={`${import.meta.env.BASE_URL}logo-journey.png`}
            alt="Colégio Journey"
            style={{ height: 44, width: 'auto', maxWidth: '100%', display: 'block', objectFit: 'contain' }}
          />
          <p style={{ margin: '10px 0 0', fontSize: 13, color: CAPTION, fontWeight: FW_LIGHT }}>controle de inventário</p>
        </div>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setTab(n.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', borderRadius: 999, marginBottom: 4, background: tab === n.id ? INK : 'transparent', color: tab === n.id ? INK_FG : CAPTION, fontWeight: tab === n.id ? FW_BOLD : FW_NORMAL, fontSize: 14, transition: 'all .15s', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', position: 'relative' }}
            onMouseEnter={e => tab !== n.id && (e.currentTarget.style.background = FILL)}
            onMouseLeave={e => tab !== n.id && (e.currentTarget.style.background = 'transparent')}
          >
            {n.icon}
            {n.label}
            {n.id === 'alertas' && alertCount > 0 && (
              <span style={{ marginLeft: 'auto', background: '#FF3B30', color: '#fff', fontSize: 11, fontWeight: FW_BOLD, padding: '2px 7px', borderRadius: 20 }}>{alertCount}</span>
            )}
          </button>
        ))}
        <button
          onClick={openNewProduct}
          aria-label="Novo produto"
          style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '12px 14px', borderRadius: 999, background: INK, color: INK_FG, fontWeight: FW_BOLD, fontSize: 14, border: 'none', width: '100%', cursor: 'pointer' }}
        >
          {Ic.plus} Novo
        </button>
      </nav>

      {/* Content area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <header style={{ padding: '22px 22px 12px', background: HEADER_BG, backdropFilter: 'blur(22px)', borderBottom: 'none', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <img
              src={`${import.meta.env.BASE_URL}logo-journey.png`}
              alt="Colégio Journey"
              style={{ height: 56, width: 'auto', maxWidth: 'min(280px, 70vw)', display: 'block', objectFit: 'contain' }}
            />
            {tab !== 'estoque' && (
              <p className="kicker" style={{ marginTop: 10 }}>{PAGE_KICKER[tab]} · {PAGE_TITLE[tab]}</p>
            )}
          </div>
        </header>

        {/* Screen */}
        <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', paddingTop: 14 }}>
          <div style={{ flex: 1, minHeight: 0, display: tab === 'estoque' ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden' }}>
            <EstoqueScreen
              products={products}
              movements={movements}
              onUpdate={handleUpdate}
              openNewKey={openNewKey}
              categories={categories}
              onCreateCategory={onCreateCategory}
              onRenameCategory={onRenameCategory}
              onRemoveCategory={onRemoveCategory}
              onOverlayChange={setHideNav}
            />
          </div>
          {tab === 'movimentacoes' && <MovimentacoesScreen products={products} movements={movements} />}
          {tab === 'alertas'       && <AlertasScreen       products={products} />}
          {tab === 'ajustes'       && <AjustesScreen       products={products} isDark={dark} setDark={setDark} onRestoreMonthList={() => {
            const restored = initialProducts.map(p => ({ ...p }))
            setProducts(restored)
            setCategories(uniqueCategories([...DEFAULT_CATEGORIES, ...restored.map(p => p.category)]))
          }} onFillIdeal={() => {
            setProducts(ps => ps.map(p => ({ ...p, stock: idealStockOf(p), used: 0 })))
          }} onExport={() => {
            generatePDF(products, 'todos', movements, new Date().getMonth())
            downloadJsonBackup(products, movements, categories, dark)
          }} onImportText={(text, fileName) => {
            const parsed = parseBackupFile(text, fileName)
            if ('error' in parsed) return parsed.error
            if (!confirm(`Substituir os ${products.length} produtos deste aparelho pelos ${parsed.products.length} do arquivo?`)) {
              return 'Importação cancelada.'
            }
            setProducts(parsed.products)
            setMovements(parsed.movements)
            setCategories(uniqueCategories([
              ...DEFAULT_CATEGORIES,
              ...(parsed.categories ?? []),
              ...parsed.products.map(p => p.category),
            ]))
            if (typeof parsed.dark === 'boolean') setDark(parsed.dark)
            return `Sincronizado: ${parsed.products.length} produtos.`
          }} />}
        </main>

        {createPortal(
          <nav className={`bottom-nav${hideNav ? ' is-hidden' : ''}`}>
            {NAV.slice(0, 2).map(n => (
              <button key={n.id} onClick={() => setTab(n.id)}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '8px 0', color: tab === n.id ? LABEL : CAPTION, border: 'none', background: 'transparent', cursor: 'pointer', transition: 'color .12s' }}
              >
                <div style={{ position: 'relative' }}>{n.icon}</div>
                <span style={{ fontSize: 10, fontWeight: tab === n.id ? FW_BOLD : FW_LIGHT }}>{n.label}</span>
              </button>
            ))}
            <button
              onClick={openNewProduct}
              aria-label="Novo produto"
              style={{ width: 48, height: 48, borderRadius: 999, background: INK, color: INK_FG, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', margin: '0 6px' }}
            >
              {Ic.plus}
            </button>
            {NAV.slice(2).map(n => (
              <button key={n.id} onClick={() => setTab(n.id)}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '8px 0', color: tab === n.id ? LABEL : CAPTION, border: 'none', background: 'transparent', cursor: 'pointer', transition: 'color .12s' }}
              >
                <div style={{ position: 'relative' }}>
                  {n.icon}
                  {n.id === 'alertas' && alertCount > 0 && (
                    <span style={{ position: 'absolute', top: -4, right: -6, background: '#FF3B30', color: '#fff', fontSize: 9, fontWeight: FW_BOLD, width: 15, height: 15, borderRadius: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #fff' }}>
                      {alertCount}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 10, fontWeight: tab === n.id ? FW_BOLD : FW_LIGHT }}>{n.label}</span>
              </button>
            ))}
          </nav>,
          document.body,
        )}
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @media (min-width: 900px) {
          .sidebar-desktop { display: flex !important; }
          .bottom-nav      { display: none !important; }
        }
        @media (max-width: 899px) {
          .sidebar-desktop { display: none !important; }
          .bottom-nav      { display: flex !important; }
          .bottom-nav.is-hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
}
