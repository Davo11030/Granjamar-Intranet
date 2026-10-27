import { useState, useCallback } from 'react'

export default function useForm(valoresIniciales, reglas = {}) {
  const [valores, setValores] = useState(valoresIniciales)
  const [errores, setErrores] = useState({})
  const [tocados, setTocados] = useState({})

  const validarCampo = useCallback((nombre, valor) => {
    const regla = reglas[nombre]
    if (!regla) return ''
    if (regla.requerido && !valor?.toString().trim()) return `${regla.label || nombre} es requerido`
    if (regla.minLength && valor?.length < regla.minLength) return `Mínimo ${regla.minLength} caracteres`
    if (regla.patron && !regla.patron.test(valor)) return regla.mensajePatron || 'Formato inválido'
    if (regla.min && Number(valor) < regla.min) return `Mínimo ${regla.min}`
    return ''
  }, [reglas])

  const handleChange = useCallback((e) => {
    const { name, value } = e.target
    setValores(prev => ({ ...prev, [name]: value }))
    if (tocados[name]) {
      setErrores(prev => ({ ...prev, [name]: validarCampo(name, value) }))
    }
  }, [tocados, validarCampo])

  const handleBlur = useCallback((e) => {
    const { name, value } = e.target
    setTocados(prev => ({ ...prev, [name]: true }))
    setErrores(prev => ({ ...prev, [name]: validarCampo(name, value) }))
  }, [validarCampo])

  const validarTodo = useCallback(() => {
    const nuevosErrores = {}
    let esValido = true
    Object.keys(reglas).forEach(nombre => {
      const error = validarCampo(nombre, valores[nombre])
      if (error) { nuevosErrores[nombre] = error; esValido = false }
    })
    setErrores(nuevosErrores)
    setTocados(Object.keys(reglas).reduce((acc, k) => ({ ...acc, [k]: true }), {}))
    return esValido
  }, [reglas, valores, validarCampo])

  const resetear = useCallback(() => {
    setValores(valoresIniciales)
    setErrores({})
    setTocados({})
  }, [valoresIniciales])

  return { valores, errores, handleChange, handleBlur, validarTodo, resetear, setValores }
}