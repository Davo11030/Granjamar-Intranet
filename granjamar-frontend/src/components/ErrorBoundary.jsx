import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white px-8">
          <h1 className="text-4xl font-bold text-marca mb-4">Algo salió mal</h1>
          <p className="text-gray-500 mb-6">{this.state.error.message}</p>
          <button onClick={() => window.location.href = '/'} className="gm-btn-guardar">
            Regresar al inicio
          </button>
        </div>
      )
    }
    return this.props.children
  }
}