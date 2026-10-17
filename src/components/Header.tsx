/**
 * Header component – appears on all protected routes.
 * Includes the top tricolor strip, app name, and language toggle pill.
 */
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'

export default function Header() {
  const { i18n: i18nInstance } = useTranslation()

  const switchLang = (lang: string) => {
    i18n.changeLanguage(lang)
    localStorage.setItem('arogya_lang', lang)
    document.documentElement.lang = lang
  }

  const current = i18nInstance.language

  return (
    <header className="app-header">
      <div className="tricolor-strip" />
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.6rem 1rem',
      }}>
        <h2 style={{
          margin: 0,
          fontWeight: 600,
          fontSize: '1.15rem',
          color: 'var(--color-primary)',
        }}>
          Arogya | आरोग्य
        </h2>
        <div className="lang-pill" role="group" aria-label="Language selector">
          <button
            className={current === 'en' ? 'active' : ''}
            onClick={() => switchLang('en')}
            id="lang-en"
          >
            EN
          </button>
          <button
            className={current === 'hi' ? 'active' : ''}
            onClick={() => switchLang('hi')}
            id="lang-hi"
          >
            हिन्दी
          </button>
        </div>
      </div>
    </header>
  )
}
