/*
  * Un gancho de geolocalización para React que utiliza Capacitor Geolocation API.
  * Proporciona coordenadas, estado de carga y manejo de errores.
  * Soporta tanto obtener la posición actual como monitorear cambios en la ubicación.
*/

'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Geolocation } from '@capacitor/geolocation'
import type { Coordinates } from '@/lib/types'

// El hook acepta opciones para configurar el comportamiento de geolocalización, como si se debe monitorear la 
// ubicación o solo obtenerla una vez, y opciones de precisión y tiempo.
interface UseGeolocationOptions {
  watch?: boolean
  enableHighAccuracy?: boolean
  timeout?: number
  maximumAge?: number
}

// El estado del hook incluye las coordenadas (si se han obtenido), un indicador de carga y un mensaje de error 
// (si ocurre alguno).
interface GeolocationState {
  coordinates: Coordinates | null
  loading: boolean
  error: string | null
}

// El hook utiliza useEffect para iniciar la geolocalización cuando el componente se monta y limpiar cualquier 
// monitoreo cuando se desmonta. También maneja el éxito y el error de la geolocalización, actualizando el estado 
// en consecuencia.
export function useGeolocation(options: UseGeolocationOptions = {}): GeolocationState {
  // Configuración predeterminada para la geolocalización, que se puede sobrescribir mediante las opciones proporcionadas.
  const {
    watch = false,
    enableHighAccuracy = true,
    timeout = 30000,
    maximumAge = 0,
  } = options

  // Estado local para almacenar las coordenadas, el estado de carga y los errores.
  const [state, setState] = useState<GeolocationState>({
    coordinates: null,
    loading: true,
    error: null,
  })

  // Referencia para almacenar el ID del watch de geolocalización, lo que permite limpiar el monitoreo cuando 
  // el componente se desmonta.
  const watchIdRef = useRef<string | null>(null)

  // Función de éxito que actualiza el estado con las coordenadas obtenidas y marca la carga como completa.
  const onSuccess = useCallback((latitude: number, longitude: number, accuracy: number) => {
    setState({
      coordinates: { latitude, longitude, accuracy },
      loading: false,
      error: null,
    })
  }, [])

  // Función de error que actualiza el estado con un mensaje de error y marca la carga como completa.
  const onError = useCallback((message: string) => {
    setState((prev) => ({ ...prev, loading: false, error: message }))
  }, [])

  // useEffect para iniciar la geolocalización cuando el componente se monta. Si watch es true, se inicia un monitoreo
  // de la ubicación, de lo contrario, se obtiene la ubicación una sola vez. También se maneja la limpieza del monitoreo
  // cuando el componente se desmonta.
  useEffect(() => {
    const positionOptions = {
      enableHighAccuracy,
      timeout,
      maximumAge,
    }

    let cancelled = false

    const start = async () => {
      try {
        const { location } = await Geolocation.checkPermissions()
        if (location === 'denied') {
          onError('Location access denied. Enable location in settings.')
          return
        }
        if (location !== 'granted') {
          const result = await Geolocation.requestPermissions()
          if (result.location !== 'granted') {
            onError('Location access denied. Enable location in settings.')
            return
          }
        }
      } catch {
        // checkPermissions no disponible en web — continuar igualmente
      }

      if (cancelled) return

      if (watch) {
        Geolocation.watchPosition(positionOptions, (position, err) => {
          if (cancelled) return
          if (err || !position) {
            onError('Unable to retrieve location.')
            return
          }
          onSuccess(position.coords.latitude, position.coords.longitude, position.coords.accuracy)
        }).then((id) => {
          if (cancelled) {
            Geolocation.clearWatch({ id })
          } else {
            watchIdRef.current = id
          }
        }).catch(() => {
          onError('Location access denied. Enable location in settings.')
        })
      } else {
        Geolocation.getCurrentPosition(positionOptions)
          .then((position) => {
            if (!cancelled) onSuccess(position.coords.latitude, position.coords.longitude, position.coords.accuracy)
          })
          .catch(() => {
            onError('Location access denied. Enable location in settings.')
          })
      }
    }

    start()

    // Limpiar el monitoreo de geolocalización cuando el componente se desmonta para evitar fugas de memoria y llamadas
    // innecesarias.
    return () => {
      cancelled = true
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch({ id: watchIdRef.current })
        watchIdRef.current = null
      }
    }
  }, [watch, enableHighAccuracy, timeout, maximumAge, onSuccess, onError])

  // Devolver el estado actual de la geolocalización, incluyendo las coordenadas, el estado de carga y cualquier error.
  return state
}