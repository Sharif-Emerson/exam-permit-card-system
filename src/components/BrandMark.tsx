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
  return (
    <div className={`flex items-center gap-3 ${align === 'center' ? 'justify-center text-center' : 'justify-start text-left'}`}>
      <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center">
        <img
          src={institutionLogo}
          alt={`${institutionName} logo`}
          className="h-full w-full object-contain"
          draggable={false}
        />
      </div>
      <div>
        <div className={titleClassName}>{institutionName}</div>
        {showSubtitle ? <div className={subtitleClassName}>Secure examination permit portal</div> : null}
      </div>
    </div>
  )
}