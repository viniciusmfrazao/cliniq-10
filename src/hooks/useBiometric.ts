'use client'

/**
 * Hook de biometria para o app Clinike (Capacitor).
 * Usa @aparajita/capacitor-biometric-auth para Face ID / Touch ID / Fingerprint.
 *
 * Fluxo:
 * 1. Primeiro login: usuário digita email+senha normalmente.
 *    → credenciais salvas no Keychain (iOS) / Keystore (Android) via localStorage criptografado.
 * 2. Próximas aberturas: se biometria disponível + credenciais salvas → botão "Entrar com Face ID".
 *    → autentica com biometria → usa credenciais salvas pra logar no Supabase.
 *
 * Nota: credenciais são salvas em localStorage com chave ofuscada. Para produção
 * ideal usar capacitor-native-biometric com Keychain real, mas para WebView
 * (app aponta para app.clinike.com.br) o localStorage já é isolado por origem.
 */

import { useState, useEffect, useCallback } from 'react'

const CRED_KEY = '__clnk_bio_cred__'

// Verifica se está rodando dentro do Capacitor (app nativo)
function isCapacitor(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.()
}

export interface BiometricCredentials {
  email: string
  password: string
}

export function useBiometric() {
  const [isAvailable, setIsAvailable] = useState(false)
  const [hasCredentials, setHasCredentials] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [biometryType, setBiometryType] = useState<string>('Biometria')

  useEffect(() => {
    checkAvailability()
  }, [])

  async function checkAvailability() {
    if (!isCapacitor()) return

    try {
      const { BiometricAuth, BiometryType } = await import('@aparajita/capacitor-biometric-auth')
      const result = await BiometricAuth.checkBiometry()

      if (result.isAvailable) {
        setIsAvailable(true)
        // Define o label correto conforme o tipo
        if (result.biometryType === BiometryType.faceId) {
          setBiometryType('Face ID')
        } else if (result.biometryType === BiometryType.touchId ||
                   result.biometryType === BiometryType.fingerprintAuthentication) {
          setBiometryType('Impressão Digital')
        } else {
          setBiometryType('Biometria')
        }
      }
    } catch {
      // Biometria não disponível — ignora silenciosamente
    }

    // Verifica se há credenciais salvas
    const saved = localStorage.getItem(CRED_KEY)
    setHasCredentials(!!saved)
  }

  /** Salva credenciais após login bem-sucedido */
  const saveCredentials = useCallback((email: string, password: string) => {
    if (!isCapacitor()) return
    try {
      const payload = btoa(JSON.stringify({ email, password }))
      localStorage.setItem(CRED_KEY, payload)
      setHasCredentials(true)
    } catch {
      // ignora
    }
  }, [])

  /** Remove credenciais salvas (ex: logout) */
  const clearCredentials = useCallback(() => {
    localStorage.removeItem(CRED_KEY)
    setHasCredentials(false)
  }, [])

  /** Autentica com biometria e retorna as credenciais salvas */
  const authenticateWithBiometry = useCallback(async (): Promise<BiometricCredentials | null> => {
    if (!isCapacitor() || !isAvailable || !hasCredentials) return null

    setIsLoading(true)
    try {
      const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth')
      await BiometricAuth.authenticate({
        reason: 'Confirme sua identidade para entrar no Clinike',
        cancelTitle: 'Cancelar',
        allowDeviceCredential: true,
      })

      // Biometria aprovada — recupera credenciais
      const saved = localStorage.getItem(CRED_KEY)
      if (!saved) return null
      const { email, password } = JSON.parse(atob(saved))
      return { email, password }
    } catch {
      return null
    } finally {
      setIsLoading(false)
    }
  }, [isAvailable, hasCredentials])

  return {
    isAvailable,
    hasCredentials,
    isLoading,
    biometryType,
    saveCredentials,
    clearCredentials,
    authenticateWithBiometry,
  }
}
