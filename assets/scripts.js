$(function () {
  $('[data-toggle="tooltip"]').tooltip()
})

;(function () {
  'use strict'

  var supportedLanguages = ['ko', 'en', 'ja']
  var storageKey = 'preferred-language'

  function getSavedLanguage () {
    try {
      var language = window.localStorage.getItem(storageKey)
      return supportedLanguages.indexOf(language) !== -1 ? language : 'ko'
    } catch (error) {
      return 'ko'
    }
  }

  function updateButtons (language) {
    document.documentElement.setAttribute('lang', language)

    document.querySelectorAll('[data-language]').forEach(function (button) {
      var isActive = button.getAttribute('data-language') === language
      button.classList.toggle('is-active', isActive)
      button.setAttribute('aria-pressed', String(isActive))
    })
  }

  function setLanguage (language) {
    if (supportedLanguages.indexOf(language) === -1) return

    var select = document.querySelector('.goog-te-combo')
    var status = document.querySelector('.language-switcher__status')

    if (language === 'ko') {
      try {
        window.localStorage.setItem(storageKey, language)
      } catch (error) {}

      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
      updateButtons(language)

      if (select && select.value) window.location.reload()
      return
    }

    if (!select) {
      if (status) status.textContent = '번역 기능을 불러오는 중입니다.'
      return
    }

    try {
      window.localStorage.setItem(storageKey, language)
    } catch (error) {}

    select.value = language
    select.dispatchEvent(new Event('change'))
    updateButtons(language)

    if (status) status.textContent = language === 'ko' ? '한국어로 변경했습니다.' : language === 'en' ? 'Changed to English.' : '日本語に変更しました。'
  }

  window.googleTranslateElementInit = function () {
    if (!window.google || !window.google.translate) return

    new window.google.translate.TranslateElement({
      pageLanguage: 'ko',
      includedLanguages: supportedLanguages.join(','),
      autoDisplay: false
    }, 'google_translate_element')

    var savedLanguage = getSavedLanguage()
    updateButtons(savedLanguage)

    if (savedLanguage !== 'ko') {
      window.setTimeout(function () { setLanguage(savedLanguage) }, 250)
    }
  }

  document.addEventListener('click', function (event) {
    var button = event.target.closest('.language-switcher__button')
    if (button) setLanguage(button.getAttribute('data-language'))
  })

  updateButtons(getSavedLanguage())
})()
