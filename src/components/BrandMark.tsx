import { ShieldCheck } from 'lucide-react'

type BrandMarkProps = {
  align?: 'left' | 'center'
  titleClassName?: string
  subtitleClassName?: string
  iconClassName?: string
}

export default function BrandMark({
  align = 'left',
  titleClassName = 'text-2xl font-bold text-slate-950',
  subtitleClassName = 'text-sm text-slate-600',
  iconClassName = 'h-6 w-6 text-white',
}: BrandMarkProps) {
  return (
    <div className={`flex items-center gap-3 ${align === 'center' ? 'justify-center text-center' : 'justify-start text-left'}`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 via-green-600 to-lime-500 shadow-md shadow-emerald-200">
        <ShieldCheck className={iconClassName} />
      </div>
      <div>
        <div className={titleClassName}>Exam Pro Permit</div>
        <div className={subtitleClassName}>Secure examination clearance</div>
      </div>
    </div>
  )
}