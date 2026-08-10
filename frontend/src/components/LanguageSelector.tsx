import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { supportedLanguages } from '@/i18n'
import { cn } from '@/lib/utils'
import { Globe } from 'lucide-react'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'

type LanguageSelectorProps = {
  variant?: 'dropdown' | 'select'
  className?: string
  buttonClassName?: string
  align?: 'start' | 'center' | 'end'
  showLabel?: boolean
}

const LANGUAGE_META: Record<string, { nativeLabel: string; secondaryLabel: string }> = {
  en: { nativeLabel: 'English', secondaryLabel: 'English' },
  hi: { nativeLabel: 'हिन्दी', secondaryLabel: 'Hindi' },
}

export const LanguageSelector: FC<LanguageSelectorProps> = ({
  variant = 'dropdown',
  className,
  buttonClassName,
  align = 'end',
  showLabel = true,
}) => {
  const { i18n, t } = useTranslation()
  const currentLanguage = i18n.resolvedLanguage ?? i18n.language

  const languageOptions = supportedLanguages.map((language) => {
    const fallback = LANGUAGE_META[language.code]
    return {
      code: language.code,
      nativeLabel: fallback?.nativeLabel ?? language.label,
      secondaryLabel: fallback?.secondaryLabel ?? language.label,
    }
  })

  const activeLanguage =
    languageOptions.find((language) => language.code === currentLanguage) ?? languageOptions[0]

  if (!activeLanguage) {
    return null
  }

  const handleLanguageChange = (value: string) => {
    if (value !== currentLanguage) {
      void i18n.changeLanguage(value)
    }
  }

  if (variant === 'select') {
    return (
      <div className={cn('w-full min-w-[200px]', className)}>
        <Select value={activeLanguage.code} onValueChange={handleLanguageChange}>
          <SelectTrigger className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm transition-colors hover:border-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-primary/20">
            <div className="flex w-full items-center gap-3 text-left">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                <Globe className="h-4 w-4" />
              </span>
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-semibold text-gray-900">
                  {activeLanguage.nativeLabel}
                </span>
                <span className="text-xs text-gray-500">{activeLanguage.secondaryLabel}</span>
              </div>
            </div>
          </SelectTrigger>
          <SelectContent className="rounded-2xl border border-slate-200 bg-white p-1 shadow-lg">
            {languageOptions.map((language) => (
              <SelectItem
                key={language.code}
                value={language.code}
                className="rounded-xl px-4 py-2.5"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-gray-900">
                    {language.nativeLabel}
                  </span>
                  <span className="text-xs text-gray-500">{language.secondaryLabel}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-white hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-primary/30 flex items-center gap-3',
            buttonClassName,
          )}
          aria-label={t('language.switcherLabel')}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            <Globe className="h-4 w-4" />
          </span>
          {showLabel ? (
            <div className="flex flex-col items-start leading-tight">
              <span className="text-[11px] uppercase tracking-wider text-slate-500">
                {t('language.switcherLabel')}
              </span>
              <span className="text-sm font-semibold text-slate-900">
                {activeLanguage.nativeLabel}
              </span>
            </div>
          ) : (
            <span className="text-sm font-semibold text-slate-900">
              {activeLanguage.nativeLabel}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className={cn(
          'w-60 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-xl backdrop-blur-lg',
          className,
        )}
      >
        <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {t('language.switcherLabel')}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={currentLanguage}
          onValueChange={handleLanguageChange}
          className="space-y-1 pt-1"
        >
          {languageOptions.map((language) => (
            <DropdownMenuRadioItem
              key={language.code}
              value={language.code}
              className="flex items-center justify-between rounded-xl border border-transparent px-3 py-2.5 text-sm transition-all hover:border-slate-200 hover:bg-slate-50 data-[state=checked]:border-primary/40 data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary-700"
            >
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-900">{language.nativeLabel}</span>
                <span className="text-xs text-slate-500">{language.secondaryLabel}</span>
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default LanguageSelector
