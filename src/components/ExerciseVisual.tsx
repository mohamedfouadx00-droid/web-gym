interface Props {
  exerciseId: string
  mode?: 'equipment' | 'movement'
  compact?: boolean
}

const stroke = '#dce7ff'
const accent = '#7c5cff'
const accent2 = '#21d4a7'
const dark = '#1a2338'

function Person({ x = 0, y = 0, pose = 'stand' }: { x?: number; y?: number; pose?: string }) {
  if (pose === 'press') return <g transform={`translate(${x} ${y})`} stroke={stroke} strokeWidth="6" strokeLinecap="round" fill="none"><circle cx="38" cy="24" r="12"/><path d="M38 38v52M38 54l-26 18M38 54l28-13M38 90l-18 38M38 90l24 36"/><path d="M66 41h30" stroke={accent2}/></g>
  if (pose === 'squat') return <g transform={`translate(${x} ${y})`} stroke={stroke} strokeWidth="6" strokeLinecap="round" fill="none"><circle cx="44" cy="24" r="12"/><path d="M44 38l-5 45M39 55L15 66M39 55l28 9M39 83l-25 26M39 83l30 23"/><path d="M8 66h18M67 64h22" stroke={accent2}/></g>
  if (pose === 'row') return <g transform={`translate(${x} ${y})`} stroke={stroke} strokeWidth="6" strokeLinecap="round" fill="none"><circle cx="42" cy="25" r="12"/><path d="M42 39l18 44M49 58L20 74M55 63l34 5M60 83l-7 42M60 83l30 35"/><path d="M89 68h32" stroke={accent2}/></g>
  if (pose === 'plank') return <g transform={`translate(${x} ${y})`} stroke={stroke} strokeWidth="6" strokeLinecap="round" fill="none"><circle cx="30" cy="61" r="11"/><path d="M42 64l80 16M58 68L38 94M106 77l28 28M106 77l34 4"/></g>
  if (pose === 'bridge') return <g transform={`translate(${x} ${y})`} stroke={stroke} strokeWidth="6" strokeLinecap="round" fill="none"><circle cx="25" cy="79" r="11"/><path d="M37 78l43-34 45 31M80 44l22 48M80 44L48 95M125 75l20 30"/></g>
  if (pose === 'lunge') return <g transform={`translate(${x} ${y})`} stroke={stroke} strokeWidth="6" strokeLinecap="round" fill="none"><circle cx="52" cy="22" r="11"/><path d="M52 35v50M52 49L29 62M52 49l22 18M52 85l-35 27M52 85l55 10M107 95l20 30"/></g>
  return <g transform={`translate(${x} ${y})`} stroke={stroke} strokeWidth="6" strokeLinecap="round" fill="none"><circle cx="45" cy="24" r="12"/><path d="M45 38v54M45 55L18 78M45 55l28 20M45 92l-20 42M45 92l24 42"/></g>
}

function Machine({ type }: { type: string }) {
  if (type === 'leg-press') return <g><path d="M55 165h155M85 160l35-80h95l-18 85" fill={dark} stroke={stroke} strokeWidth="6"/><path d="M135 75l75-38 28 52-74 38z" fill={accent} opacity=".9"/><path d="M62 160l22-52 48 20-14 32" fill={accent2} opacity=".8"/><Person x={96} y={65} pose="squat"/></g>
  if (type === 'lat-pulldown') return <g><path d="M70 28h170v155H70z" fill={dark} stroke={stroke} strokeWidth="6"/><path d="M95 42v112M215 42v112M85 160h145" stroke={accent} strokeWidth="8"/><path d="M110 55h85" stroke={accent2} strokeWidth="7"/><path d="M153 55v40" stroke={stroke} strokeWidth="4"/><Person x={110} y={72}/></g>
  if (type === 'seated-row') return <g><path d="M55 36h70v135H55z" fill={dark} stroke={stroke} strokeWidth="6"/><circle cx="88" cy="67" r="18" fill={accent}/><path d="M122 70l95 45M135 150h115M170 112l25-28" stroke={accent2} strokeWidth="6"/><Person x={135} y={65} pose="row"/></g>
  if (type === 'machine-chest-press' || type === 'machine-shoulder-press') return <g><path d="M62 45h65v128H62z" fill={dark} stroke={stroke} strokeWidth="6"/><path d="M130 70h85v95h-85z" fill={dark} stroke={stroke} strokeWidth="6"/><path d="M154 75v75M118 95h30M196 95h30" stroke={accent} strokeWidth="8"/><Person x={125} y={52} pose="press"/></g>
  if (type === 'seated-leg-curl') return <g><path d="M70 62h140v45H70zM92 105v55M185 105v55" fill={dark} stroke={stroke} strokeWidth="6"/><circle cx="218" cy="128" r="20" fill={accent}/><Person x={95} y={38}/></g>
  if (type === 'hip-thrust-machine') return <g><path d="M55 108h170v30H55zM70 138v35M210 138v35" fill={dark} stroke={stroke} strokeWidth="6"/><path d="M88 75h100" stroke={accent} strokeWidth="12"/><Person x={75} y={35} pose="bridge"/></g>
  if (type === 'cable-curl') return <g><path d="M58 30h74v145H58z" fill={dark} stroke={stroke} strokeWidth="6"/><circle cx="95" cy="60" r="17" fill={accent}/><path d="M112 70l75 60" stroke={accent2} strokeWidth="5"/><Person x={155} y={58}/></g>
  return <g><rect x="45" y="36" width="170" height="135" rx="18" fill={dark} stroke={stroke} strokeWidth="6"/><path d="M72 145h116M85 60h90" stroke={accent} strokeWidth="8"/><Person x={95} y={50}/></g>
}

function Movement({ id }: { id: string }) {
  const pose = id.includes('squat') || id === 'leg-press' ? 'squat' : id.includes('row') || id === 'lat-pulldown' ? 'row' : id.includes('plank') ? 'plank' : id.includes('bridge') || id.includes('hip-thrust') ? 'bridge' : id.includes('lunge') ? 'lunge' : id.includes('press') || id.includes('push') ? 'press' : 'stand'
  return <g><rect x="14" y="18" width="142" height="168" rx="20" fill="#111a2d" stroke="#2b3858"/><rect x="164" y="18" width="142" height="168" rx="20" fill="#111a2d" stroke="#2b3858"/><text x="85" y="41" fill="#9ca8bb" textAnchor="middle" fontSize="15">البداية</text><text x="235" y="41" fill="#9ca8bb" textAnchor="middle" fontSize="15">النهاية</text><Person x={35} y={48} pose={pose}/><g transform="translate(150 0)"><Person x={35} y={48} pose={pose}/></g><path d="M148 102h18" stroke={accent2} strokeWidth="5" markerEnd="url(#arrow)"/></g>
}

export default function ExerciseVisual({ exerciseId, mode = 'equipment', compact = false }: Props) {
  const isHome = ['push-up','plank','goblet-squat','chair-squat','incline-push-up','backpack-row','glute-bridge','dead-bug','reverse-lunge','pike-push-up','backpack-rdl'].includes(exerciseId)
  return <div className={`exercise-visual ${compact ? 'compact' : ''}`} aria-label={mode === 'equipment' ? 'صورة توضيحية للجهاز أو الأداة' : 'صورة توضيحية للحركة'}>
    <svg viewBox="0 0 320 205" role="img">
      <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6Z" fill={accent2}/></marker></defs>
      <rect width="320" height="205" rx="24" fill="#0b1221"/>
      {mode === 'movement' ? <Movement id={exerciseId}/> : isHome ? <Movement id={exerciseId}/> : <Machine type={exerciseId}/>} 
    </svg>
  </div>
}
