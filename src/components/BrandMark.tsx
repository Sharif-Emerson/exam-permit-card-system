import { institutionName } from '../config/branding'
import InstitutionLogo from './InstitutionLogo'

type BrandMarkProps = {
  align?: 'left' | 'center'
  titleClassName?: string
  subtitleClassName?: string
  showSubtitle?: boolean
}

export default function BrandMark({
  align = 'left',
  titleClassName = 'text-2xl font-bold text-slate-950',
  subtitleClassName = 'text-sm text-slate-600',
  showSubtitle = true,
}: BrandMarkProps) {
  const centered = align === 'center'
  return (
    <div className={`flex gap-3 ${centered ? 'flex-col items-center justify-center text-center' : 'items-center justify-start text-left'}`}>
      <style>{`
        @keyframes brand-ribbon-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .brand-ribbon-border {
          position: relative;
          border-radius: 50%;
          padding: 2px;
          overflow: hidden;
          flex-shrink: 0;
        }
        .brand-ribbon-border::before {
          content: '';
          position: absolute;
          inset: -120%;
          border-radius: 50%;
          background: conic-gradient(from 0deg, #2563eb 0deg, #dc2626 120deg, #eab308 240deg, #2563eb 360deg);
          animation: brand-ribbon-spin 3s linear infinite;
          z-index: 0;
          opacity: 0.95;
        }
        .brand-ribbon-border > * {
          position: relative;
          z-index: 1;
        }
      `}</style>
      <div className="brand-ribbon-border h-20 w-20">
        <div className="flex h-full w-full items-center justify-center rounded-full bg-white shadow-sm dark:bg-slate-900">
          <InstitutionLogo
            alt={`${institutionName} logo`}
            className="h-full w-full rounded-full object-cover"
            fallbackClassName="flex h-full w-full items-center justify-center rounded-full bg-emerald-700 text-base font-black tracking-[0.18em] text-white"
            draggable={false}
          />
        </div>
      </div>
      <div className={centered ? 'space-y-1' : ''}>
        <div className={titleClassName}>{institutionName}</div>
        {showSubtitle ? <div className={subtitleClassName}>Secure examination permit portal</div> : null}
      </div>
    </div>
  )
}