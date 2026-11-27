import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import RutaAdmin from './components/RutaAdmin'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NotFound from './pages/NotFound'
import Cargando from './components/Cargando'

// Cada pantalla se descarga al entrar a ella (no todo al abrir la intranet): el PDF y el Excel solo se bajan
// en las pantallas que los usan.
const Inventario = lazy(() => import('./pages/inventario/Inventario'))
const Conpaq = lazy(() => import('./pages/inventario/Conpaq'))
const Pedimentos = lazy(() => import('./pages/pedimentos/pedimentos'))
const Produccion = lazy(() => import('./pages/produccion/Produccion'))
const ProduccionForm = lazy(() => import('./pages/produccion/ProduccionForm'))
const Entradas = lazy(() => import('./pages/entradas/Entradas'))
const EntradaNacional = lazy(() => import('./pages/entradas/Nacional'))
const EntradaInternacional = lazy(() => import('./pages/entradas/Internacional'))
const EntradaTraspaso = lazy(() => import('./pages/entradas/EntradaTraspaso'))
const EntradaEditar = lazy(() => import('./pages/entradas/EntradaEditar'))
const Ventas = lazy(() => import('./pages/salidas/Ventas'))
const VentaMostrador = lazy(() => import('./pages/salidas/VentaMostrador'))
const VentaMayoreo = lazy(() => import('./pages/salidas/VentaMayoreo'))
const VentaEditar = lazy(() => import('./pages/salidas/VentaEditar'))
const CorteCaja = lazy(() => import('./pages/salidas/CorteCaja'))
const Embarques = lazy(() => import('./pages/salidas/Embarques'))
const EmbarqueDetalle = lazy(() => import('./pages/salidas/EmbarqueDetalle'))
const Requisicion = lazy(() => import('./pages/salidas/Requisicion'))
const Solicitud = lazy(() => import('./pages/salidas/Solicitud'))
const RT = lazy(() => import('./pages/salidas/RT'))
const CiegoDeCarga = lazy(() => import('./pages/salidas/CiegoDeCarga'))
const Otros = lazy(() => import('./pages/otros/Otros'))
const Operadores = lazy(() => import('./pages/otros/Operadores'))
const Kardex = lazy(() => import('./pages/otros/Kardex'))
const CatalogosKardex = lazy(() => import('./pages/admin/CatalogosKardex'))
const Destinos = lazy(() => import('./pages/otros/Destinos'))
const ClavesSat = lazy(() => import('./pages/otros/ClavesSat'))
const Movimientos = lazy(() => import('./pages/admin/Movimientos'))
const Usuarios = lazy(() => import('./pages/admin/Usuarios'))
const Visitantes = lazy(() => import('./pages/otros/Visitantes'))
const Bajas = lazy(() => import('./pages/admin/Bajas'))
const Clientes = lazy(() => import('./pages/clientes/Clientes'))
const Empresas = lazy(() => import('./pages/admin/Empresas'))
const Documentos = lazy(() => import('./pages/admin/Documentos'))
const InventarioResguardo = lazy(() => import('./pages/inventario/Resguardo'))
const InventarioConsignacion = lazy(() => import('./pages/inventario/Consignacion'))
const ConsignacionHistorial = lazy(() => import('./pages/inventario/ConsignacionHistorial'))
const PedidosConsignacion = lazy(() => import('./pages/inventario/PedidosConsignacion'))
const SolicitudesProduccion = lazy(() => import('./pages/inventario/SolicitudesProduccion'))
const ResguardoHistorial = lazy(() => import('./pages/inventario/ResguardoHistorial'))

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Cargando />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/inventario" element={<ProtectedRoute permiso={['inventario','ver']}><Inventario /></ProtectedRoute>} />
          <Route path="/inventario/conpaq" element={<ProtectedRoute permiso={['inventario','ver']}><Conpaq /></ProtectedRoute>} />
          <Route path="/pedimentos" element={<ProtectedRoute permiso={['documentos','ver']}><Pedimentos /></ProtectedRoute>} />
          <Route path="/produccion" element={<ProtectedRoute permiso={['produccion','ver']}><Produccion /></ProtectedRoute>} />
          <Route path="/produccion/reportes" element={<Navigate to="/produccion" replace />} />
          <Route path="/produccion/nueva" element={<ProtectedRoute permiso={['produccion','crear']}><ProduccionForm modo="nuevo" /></ProtectedRoute>} />
          <Route path="/produccion/:id" element={<ProtectedRoute permiso={['produccion','ver']}><ProduccionForm modo="ver" /></ProtectedRoute>} />
          <Route path="/produccion/:id/editar" element={<ProtectedRoute permiso={['produccion','editar']}><ProduccionForm modo="editar" /></ProtectedRoute>} />
          <Route path="/entradas" element={<ProtectedRoute permiso={['compras','ver']}><Entradas /></ProtectedRoute>} />
          <Route path="/entradas/nacional" element={<ProtectedRoute permiso={['compras','crear']}><EntradaNacional /></ProtectedRoute>} />
          <Route path="/entradas/internacional" element={<ProtectedRoute permiso={['compras','crear']}><EntradaInternacional /></ProtectedRoute>} />
          <Route path="/entradas/:id/editar" element={<ProtectedRoute permiso={['compras','editar']}><EntradaEditar /></ProtectedRoute>} />
          <Route path="/entradas/traspaso" element={<ProtectedRoute permiso={['compras','crear']}><EntradaTraspaso /></ProtectedRoute>} />
          <Route path="/salidas/ventas" element={<ProtectedRoute permiso={['ventas','ver']}><Ventas /></ProtectedRoute>} />
          <Route path="/salidas/ventas/mostrador" element={<ProtectedRoute permiso={['ventas','crear']}><VentaMostrador /></ProtectedRoute>} />
          <Route path="/salidas/ventas/mayoreo" element={<ProtectedRoute permiso={['ventas','crear']}><VentaMayoreo /></ProtectedRoute>} />
          <Route path="/salidas/ventas/:id/editar" element={<ProtectedRoute permiso={['ventas','editar']}><VentaEditar /></ProtectedRoute>} />
          <Route path="/salidas/ventas/corte" element={<ProtectedRoute permiso={[['ventas','corte'],['ventas','ver']]}><CorteCaja /></ProtectedRoute>} />
          <Route path="/salidas/embarques" element={<ProtectedRoute permiso={['embarques','ver']}><Embarques /></ProtectedRoute>} />
          <Route path="/salidas/embarques/:id" element={<ProtectedRoute permiso={['embarques','ver']}><EmbarqueDetalle /></ProtectedRoute>} />
          <Route path="/salidas/embarques/:id/requisicion" element={<ProtectedRoute permiso={['embarques','ver']}><Requisicion /></ProtectedRoute>} />
          <Route path="/salidas/embarques/:id/solicitud" element={<ProtectedRoute permiso={['embarques','ver']}><Solicitud /></ProtectedRoute>} />
          <Route path="/salidas/embarques/:id/rt" element={<ProtectedRoute permiso={['embarques','ver']}><RT /></ProtectedRoute>} />
          <Route path="/salidas/embarques/:id/ciego" element={<ProtectedRoute permiso={['embarques','ver']}><CiegoDeCarga /></ProtectedRoute>} />
          <Route path="/otros" element={<ProtectedRoute permiso={[['productos','ver'],['catalogos','ver'],['direcciones','ver']]}><Otros /></ProtectedRoute>} />
          <Route path="/otros/operadores" element={<ProtectedRoute permiso={['catalogos','ver']}><Operadores /></ProtectedRoute>} />
          <Route path="/otros/kardex" element={<ProtectedRoute permiso={['productos','ver']}><Kardex /></ProtectedRoute>} />
          <Route path="/otros/destinos" element={<ProtectedRoute permiso={['direcciones','ver']}><Destinos /></ProtectedRoute>} />
          <Route path="/otros/claves-sat" element={<ProtectedRoute permiso={['catalogos','ver']}><ClavesSat /></ProtectedRoute>} />
          <Route path="/admin/movimientos" element={<RutaAdmin><Movimientos /></RutaAdmin>} />
          <Route path="/admin/usuarios" element={<RutaAdmin><Usuarios /></RutaAdmin>} />
          <Route path="/admin/catalogos-kardex" element={<RutaAdmin><CatalogosKardex /></RutaAdmin>} />
          <Route path="/salidas/embarques/nuevo/requisicion" element={<ProtectedRoute permiso={['embarques','crear']}><Requisicion /></ProtectedRoute>} />
          <Route path="/admin/visitantes" element={<RutaAdmin><Visitantes /></RutaAdmin>} />
          <Route path="/admin/bajas" element={<RutaAdmin><Bajas /></RutaAdmin>} />
          <Route path="/clientes" element={<ProtectedRoute permiso={['clientes','ver']}><Clientes /></ProtectedRoute>} />
          <Route path="/admin/empresas" element={<RutaAdmin><Empresas /></RutaAdmin>} />
          <Route path="/admin/documentos" element={<RutaAdmin><Documentos /></RutaAdmin>} />
          <Route path="/inventario/resguardo/:IdEmpresa" element={<ProtectedRoute permiso={['inventario','ver']}><InventarioResguardo /></ProtectedRoute>} />
          <Route path="/inventario/consignacion/:IdEmpresa" element={<ProtectedRoute permiso={['inventario','ver']}><InventarioConsignacion /></ProtectedRoute>}/>
          <Route path="/inventario/consignacion/:IdEmpresa/solicitudes" element={<ProtectedRoute permiso={['inventario','ver']}><SolicitudesProduccion /></ProtectedRoute>}/>
          <Route path="/inventario/consignacion/:IdEmpresa/pedidos" element={<ProtectedRoute permiso={['inventario','ver']}><PedidosConsignacion /></ProtectedRoute>}/>
          <Route path="/inventario/consignacion/:IdEmpresa/:id" element={<ProtectedRoute permiso={['inventario','ver']}><ConsignacionHistorial /></ProtectedRoute>}/>
          <Route path="/inventario/resguardo/:IdEmpresa/:id" element={<ProtectedRoute permiso={['inventario','ver']}><ResguardoHistorial /></ProtectedRoute>}/>
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}