import { institutionName, institutionLogo } from '../config/branding'

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
      <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center">
        <img
          src={institutionLogo}
          alt={`${institutionName} logo`}
          className="h-full w-full object-contain"
          draggable={false}
        />
      </div>
      <div className={centered ? 'space-y-1' : ''}>
        <div className={titleClassName}>{institutionName}</div>
        {showSubtitle ? <div className={subtitleClassName}>Secure examination permit portal</div> : null}
      </div>
    </div>
  )
}