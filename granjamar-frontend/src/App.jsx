import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import RutaAdmin from './components/RutaAdmin'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Inventario from './pages/inventario/Inventario'
import Conpaq from './pages/inventario/Conpaq'
import Pedimentos from './pages/pedimentos/pedimentos'
import Produccion from './pages/produccion/Produccion'
import ProduccionReportes from './pages/produccion/ProduccionReportes'
import ProduccionForm from './pages/produccion/ProduccionForm'
import Entradas from './pages/entradas/Entradas'
import EntradaNacional from './pages/entradas/Nacional'
import EntradaInternacional from './pages/entradas/Internacional'
import EntradaTraspaso from './pages/entradas/EntradaTraspaso'
import EntradaEditar from './pages/entradas/EntradaEditar'
import Ventas from './pages/salidas/Ventas'
import VentaMostrador from './pages/salidas/VentaMostrador'
import VentaMayoreo from './pages/salidas/VentaMayoreo'
import CorteCaja from './pages/salidas/CorteCaja'
import Embarques from './pages/salidas/Embarques'
import EmbarqueDetalle from './pages/salidas/EmbarqueDetalle'
import Requisicion from './pages/salidas/Requisicion'
import Solicitud from './pages/salidas/Solicitud'
import RT from './pages/salidas/RT'
import CiegoDeCarga from './pages/salidas/CiegoDeCarga'
import Otros from './pages/otros/Otros'
import Operadores from './pages/otros/Operadores'
import Kardex from './pages/otros/Kardex'
import Destinos from './pages/otros/Destinos'
import ClavesSat from './pages/otros/ClavesSat'
import Movimientos from './pages/admin/Movimientos'
import Usuarios from './pages/admin/Usuarios'
import Visitantes from './pages/otros/Visitantes'
import Clientes from './pages/clientes/Clientes'
import Empresas from './pages/admin/Empresas'
import NotFound from './pages/NotFound'
import InventarioResguardo from './pages/inventario/Resguardo'
import InventarioConsignacion from './pages/inventario/Consignacion'
import ConsignacionHistorial from './pages/inventario/ConsignacionHistorial'
import PedidosConsignacion from './pages/inventario/PedidosConsignacion'
import SolicitudesProduccion from './pages/inventario/SolicitudesProduccion'
import ResguardoHistorial from './pages/inventario/ResguardoHistorial'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/inventario" element={<ProtectedRoute permiso={['inventario','ver']}><Inventario /></ProtectedRoute>} />
          <Route path="/inventario/conpaq" element={<ProtectedRoute permiso={['inventario','ver']}><Conpaq /></ProtectedRoute>} />
          <Route path="/inventario/consignacion/:idEmpresa" element={<ProtectedRoute permiso={['inventario','ver']}><InventarioConsignacion /></ProtectedRoute>} />
          <Route path="/pedimentos" element={<ProtectedRoute permiso={['documentos','ver']}><Pedimentos /></ProtectedRoute>} />
          <Route path="/produccion" element={<ProtectedRoute permiso={['produccion','ver']}><Produccion /></ProtectedRoute>} />
          <Route path="/produccion/reportes" element={<ProtectedRoute permiso={['produccion','ver']}><ProduccionReportes /></ProtectedRoute>} />
          <Route path="/produccion/nueva" element={<ProtectedRoute permiso={['produccion','crear']}><ProduccionForm modo="nuevo" /></ProtectedRoute>} />
          <Route path="/produccion/:id" element={<ProtectedRoute permiso={['produccion','ver']}><ProduccionForm modo="ver" /></ProtectedRoute>} />
          <Route path="/produccion/:id/editar" element={<ProtectedRoute permiso={['produccion','editar']}><ProduccionForm modo="editar" /></ProtectedRoute>} />
          <Route path="/entradas" element={<ProtectedRoute permiso={['compras','ver']}><Entradas /></ProtectedRoute>} />
          <Route path="/entradas/nacional" element={<ProtectedRoute permiso={['compras','crear']}><EntradaNacional /></ProtectedRoute>} />
          <Route path="/entradas/internacional" element={<ProtectedRoute permiso={['compras','crear']}><EntradaInternacional /></ProtectedRoute>} />
          <Route path="/entradas/adquisicion" element={<ProtectedRoute permiso={['compras','crear']}><EntradaNacional /></ProtectedRoute>} />
          <Route path="/entradas/:id/editar" element={<ProtectedRoute permiso={['compras','editar']}><EntradaEditar /></ProtectedRoute>} />
          <Route path="/entradas/traspaso" element={<ProtectedRoute permiso={['compras','crear']}><EntradaTraspaso /></ProtectedRoute>} />
          <Route path="/salidas/ventas" element={<ProtectedRoute permiso={['ventas','ver']}><Ventas /></ProtectedRoute>} />
          <Route path="/salidas/ventas/mostrador" element={<ProtectedRoute permiso={['ventas','crear']}><VentaMostrador /></ProtectedRoute>} />
          <Route path="/salidas/ventas/mayoreo" element={<ProtectedRoute permiso={['ventas','crear']}><VentaMayoreo /></ProtectedRoute>} />
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
          <Route path="/salidas/embarques/nuevo/requisicion" element={<ProtectedRoute permiso={['embarques','crear']}><Requisicion /></ProtectedRoute>} />
          <Route path="/admin/visitantes" element={<RutaAdmin><Visitantes /></RutaAdmin>} />
          <Route path="/clientes" element={<ProtectedRoute permiso={['clientes','ver']}><Clientes /></ProtectedRoute>} />
          <Route path="/admin/empresas" element={<RutaAdmin><Empresas /></RutaAdmin>} />
          <Route path="/inventario/resguardo/:IdEmpresa" element={<ProtectedRoute permiso={['inventario','ver']}><InventarioResguardo /></ProtectedRoute>} />
          <Route path="/inventario/consignacion/:IdEmpresa" element={<ProtectedRoute permiso={['inventario','ver']}><InventarioConsignacion /></ProtectedRoute>}/>
          <Route path="/inventario/consignacion/:IdEmpresa/solicitudes" element={<ProtectedRoute permiso={['inventario','ver']}><SolicitudesProduccion /></ProtectedRoute>}/>
          <Route path="/inventario/consignacion/:IdEmpresa/pedidos" element={<ProtectedRoute permiso={['inventario','ver']}><PedidosConsignacion /></ProtectedRoute>}/>
          <Route path="/inventario/consignacion/:IdEmpresa/:id" element={<ProtectedRoute permiso={['inventario','ver']}><ConsignacionHistorial /></ProtectedRoute>}/>
          <Route path="/inventario/resguardo/:IdEmpresa/:id" element={<ProtectedRoute permiso={['inventario','ver']}><ResguardoHistorial /></ProtectedRoute>}/>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}