import Navbar from './Navbar';
import Hero from './Hero';
import Footer from './Footer';
import Products from './Products';
import { Routes, Route } from "react-router-dom";
import ProductDetail from './ProductDetail';
import Cart from './Cart';
import WishList from './Wishlist';
import { Toaster } from 'react-hot-toast';
import Checkout from './Checkout';
import Chatbot from './Chatbot';
import Orders from './Orders';
import OrderDetail from './OrderDetail';
import OrderConfirmation from './OrderConfirmation';
import AdminDashboard from './AdminDashboard';
import Login from './Login';
import Register from './Register';
import ForgotPassword from './ForgotPassword';
import ProtectedRoute from './ProtectedRoute';

// Nouveaux composants UX/UI
import ErrorBoundary from './components/ErrorBoundary';
import ToastProvider from './components/ToastProvider';
import AnimatedContainer from './components/AnimatedContainer';

// Page de test des composants UX/UI (développement uniquement)
import TestUXComponents from './test-ux-components';

// Styles responsive
import './styles/responsive.css';

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <div className="min-h-screen flex flex-col bg-gray-50">
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                theme: {
                  primary: 'green',
                  secondary: 'black',
                },
              },
            }}
          />
          
          <Navbar />

          <main className="flex-1">
            <AnimatedContainer animation="fadeIn" duration={300}>
              <Routes>
                <Route path="/" element={<Hero />} />
                <Route path="/products" element={<Products />} />
                <Route path="/product-detail/:id" element={<ProductDetail />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />

                {/* Route de test pour les composants UX/UI (développement) */}
                {process.env.NODE_ENV === 'development' && (
                  <Route path="/test-ux" element={<TestUXComponents />} />
                )}

                {/* Routes protégées avec animation */}
                <Route path="/cart" element={
                  <ProtectedRoute>
                    <AnimatedContainer animation="slideUp">
                      <Cart />
                    </AnimatedContainer>
                  </ProtectedRoute>
                } />
                <Route path="/wishlist" element={
                  <ProtectedRoute>
                    <AnimatedContainer animation="slideUp">
                      <WishList />
                    </AnimatedContainer>
                  </ProtectedRoute>
                } />
                <Route path="/checkout" element={
                  <ProtectedRoute>
                    <AnimatedContainer animation="slideUp">
                      <Checkout />
                    </AnimatedContainer>
                  </ProtectedRoute>
                } />
                <Route path="/orders" element={
                  <ProtectedRoute>
                    <AnimatedContainer animation="slideUp">
                      <Orders />
                    </AnimatedContainer>
                  </ProtectedRoute>
                } />
                <Route path="/order-detail/:id" element={
                  <ProtectedRoute>
                    <AnimatedContainer animation="slideUp">
                      <OrderDetail />
                    </AnimatedContainer>
                  </ProtectedRoute>
                } />
                <Route path="/order-confirmation/:id" element={
                  <ProtectedRoute>
                    <AnimatedContainer animation="slideUp">
                      <OrderConfirmation />
                    </AnimatedContainer>
                  </ProtectedRoute>
                } />
                <Route path="/admin" element={
                  <ProtectedRoute adminOnly>
                    <AnimatedContainer animation="slideUp">
                      <AdminDashboard />
                    </AnimatedContainer>
                  </ProtectedRoute>
                } />
              </Routes>
            </AnimatedContainer>
            
            <Chatbot />
          </main>

          <Footer />
        </div>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;