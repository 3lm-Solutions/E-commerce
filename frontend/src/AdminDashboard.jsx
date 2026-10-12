import { useState, useEffect, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import { 
  LayoutDashboard, ShoppingBag, Users, Settings, 
  TrendingUp, Package, DollarSign, Bell, Search, 
Sparkles, ArrowUpRight, MoreVertical, X, CheckCircle2, ArrowUpDown, Loader2, Plus, Pencil, Trash2, Tag, FolderTree,
Eye, Calendar, RefreshCw, MapPin, CreditCard, Truck, Filter, Power, RotateCcw, UserCheck, BarChart3,
  UserPlus, AlertTriangle, History
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend
} from 'recharts';
import { Link } from 'react-router-dom';
import useCartStore from './store/cartStore';
import useAuth from './store/useAuth';
import { apiFetch } from './lib/api';
import ProductFormModal from './components/ProductFormModal';
import CategoryFormModal from './components/CategoryFormModal';
import ConfirmDeleteModal from './components/ConfirmDeleteModal';

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [productsCount, setProductsCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef(null);

// State pour la gestion des produits
  const [products, setProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState(null);
  const [productSearch, setProductSearch] = useState('');
  const [productSort, setProductSort] = useState('date-desc');
  const [productsPerPage, setProductsPerPage] = useState(15);
  const [productsCurrentPage, setProductsCurrentPage] = useState(1);

// State du modal produit (création / édition)
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

// State du modal de confirmation de suppression
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState(null);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);

// State pour la gestion des catégories
  const [categories, setCategories] = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [categoriesError, setCategoriesError] = useState(null);

// State du modal catégorie (création / édition)
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

// State du modal de confirmation de suppression de catégorie
  const [deleteConfirmCategory, setDeleteConfirmCategory] = useState(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

// ─────────────────────────────────────────────
  // State pour la gestion des clients (FonctionnalitéMoyenne#428)
  // ─────────────────────────────────────────────
  const [adminUsers, setAdminUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState(null);
  const [userSearchFilter, setUserSearchFilter] = useState('');
  const [usersCurrentPage, setUsersCurrentPage] = useState(1);
  const [usersPagination, setUsersPagination] = useState({ total: 0, totalPages: 1, page: 1, limit: 20 });
  const [usersPerPage, setUsersPerPage] = useState(20);

  // Modal profil client (FonctionnalitéMoyenne#428)
  const [selectedUser, setSelectedUser] = useState(null);
  const [isLoadingUserDetail, setIsLoadingUserDetail] = useState(false);
  const [userDetailError, setUserDetailError] = useState(null);

  // Filtre de l'historique des commandes du client (par statut)
  const [userOrderStatusFilter, setUserOrderStatusFilter] = useState('');

  // Modal de confirmation de désactivation d'un client
  const [deactivateConfirmUser, setDeactivateConfirmUser] = useState(null);
  const [isUpdatingUserActive, setIsUpdatingUserActive] = useState(false);

  // Utilisateur admin connecté (pour masquer le bouton désactiver sur soi-même)
  const { user: currentAdmin } = useAuth();

// ─────────────────────────────────────────────
  // State pour la gestion des commandes (FonctionnalitéHaute#427)
  // ─────────────────────────────────────────────
  const [adminOrders, setAdminOrders] = useState([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [orderDateFilter, setOrderDateFilter] = useState('');
  const [orderClientFilter, setOrderClientFilter] = useState('');
  const [ordersCurrentPage, setOrdersCurrentPage] = useState(1);
  const [ordersPagination, setOrdersPagination] = useState({ total: 0, totalPages: 1, page: 1, limit: 20 });
  const [ordersPerPage, setOrdersPerPage] = useState(20);

  // Modal détail commande
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isLoadingOrderDetail, setIsLoadingOrderDetail] = useState(false);
  const [orderDetailError, setOrderDetailError] = useState(null);
const [selectedNewStatus, setSelectedNewStatus] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

// ─────────────────────────────────────────────
  // State pour les analytics (chiffre d'affaires + top produits)
  // ─────────────────────────────────────────────
  const [revenuePeriod, setRevenuePeriod] = useState('7d');
  const [revenueData, setRevenueData] = useState({ series: [], totalRevenue: 0, totalOrders: 0 });
  const [isLoadingRevenue, setIsLoadingRevenue] = useState(false);
  const [revenueError, setRevenueError] = useState(null);

const [topProducts, setTopProducts] = useState([]);
  const [isLoadingTopProducts, setIsLoadingTopProducts] = useState(false);
  const [topProductsError, setTopProductsError] = useState(null);

  // ─────────────────────────────────────────────
  // State des métriques précises du tableau de bord (FonctionnalitéHaute#429)
  // ─────────────────────────────────────────────
  const [dashboardMetrics, setDashboardMetrics] = useState({
    totalRevenue: 0,
    todayOrdersCount: 0,
    newCustomersCount: 0,
    outOfStockCount: 0,
    lowStockProducts: []
  });
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [metricsError, setMetricsError] = useState(null);

  // 10 dernières commandes (tab overview)
  const [recentOrders, setRecentOrders] = useState([]);
  const [isLoadingRecentOrders, setIsLoadingRecentOrders] = useState(false);
  const [recentOrdersError, setRecentOrdersError] = useState(null);

  // Dismiss temporaire des bandeaux d'alerte stock (pas persistant)
  const [isLowStockAlertDismissed, setIsLowStockAlertDismissed] = useState(false);
  const [isOutOfStockAlertDismissed, setIsOutOfStockAlertDismissed] = useState(false);

  // Mapping des statuts backend (anglais) → français pour l'affichage
  const STATUS_LABELS = {
    pending: 'En attente de paiement',
    confirmed: 'Confirmée',
    processing: 'En préparation',
    shipped: 'Expédiée',
    delivered: 'Livrée',
    cancelled: 'Annulée'
  };

  // Couleurs des badges selon le statut
  const STATUS_BADGES = {
    pending: 'bg-gray-100 text-gray-700',
    confirmed: 'bg-blue-100 text-blue-700',
    processing: 'bg-indigo-100 text-indigo-700',
    shipped: 'bg-orange-100 text-orange-700',
    delivered: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700'
  };

  // Mapping des commandes backend vers le format attendu par le dashboard
  function mapAdminOrders(ordersList) {
    return (ordersList || []).map((order) => {
      const items = (order.items || []).map((item) => ({
        id: item.productId,
        name: item.name || '',
        price: parseFloat(item.price || 0),
        quantity: item.quantity || 1,
        total: parseFloat(item.total || (item.price * item.quantity) || 0)
      }));
      const customer = order.user?.name || order.shippingAddress?.fullName || '';
      const addressStr = order.shippingAddress
        ? `${order.shippingAddress.address || ''}, ${order.shippingAddress.postalCode || ''} ${order.shippingAddress.city || ''}`
        : '';
      return {
        id: order.orderId || order.id,
        orderId: order.orderId,
        internalId: order.id,
        date: order.createdAt ? new Date(order.createdAt).toLocaleDateString('fr-FR') : '',
        isoDate: order.createdAt,
        status: STATUS_LABELS[order.status] || order.status || 'En attente de paiement',
        _status: order.status,
        total: parseFloat(order.totalAmount || 0),
        customer,
        email: order.user?.email || '',
        address: addressStr,
        items,
        itemsCount: items.length,
        trackingNumber: order.trackingNumber,
        paymentMethod: order.paymentMethod,
        shippingAddress: order.shippingAddress,
        availableTransitions: order.availableTransitions || []
      };
    });
  }

  // Rafraîchir la liste des commandes admin (avec filtres + pagination)
  async function loadAdminOrders() {
    setIsLoadingOrders(true);
    setOrdersError(null);
    try {
      const params = new URLSearchParams({
        page: ordersCurrentPage,
        limit: ordersPerPage
      });
      if (orderStatusFilter) params.set('status', orderStatusFilter);
      if (orderDateFilter) params.set('startDate', orderDateFilter);
      if (orderClientFilter.trim()) params.set('userEmail', orderClientFilter.trim());

      const res = await apiFetch(`/api/admin/orders?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || 'Erreur lors de la récupération des commandes');
      }
      setAdminOrders(mapAdminOrders(data?.data?.orders ?? []));
      const pag = data?.data?.pagination || {};
      setOrdersPagination({
        total: pag.total || 0,
        totalPages: pag.totalPages || 1,
        page: pag.page || 1,
        limit: pag.limit || 20
      });
    } catch (error) {
      setOrdersError(error?.message || 'Impossible de charger les commandes.');
    } finally {
      setIsLoadingOrders(false);
    }
  }

  // Fetch des commandes admin quand on ouvre le tab ou change de filtre/page
  useEffect(() => {
    if (activeTab !== 'orders') return;
    let cancelled = false;
    (async () => {
      setIsLoadingOrders(true);
      setOrdersError(null);
      try {
        const params = new URLSearchParams({
          page: ordersCurrentPage,
          limit: ordersPerPage
        });
        if (orderStatusFilter) params.set('status', orderStatusFilter);
        if (orderDateFilter) params.set('startDate', orderDateFilter);
        if (orderClientFilter.trim()) params.set('userEmail', orderClientFilter.trim());

        const res = await apiFetch(`/api/admin/orders?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.message || 'Erreur lors de la récupération des commandes');
        }
        if (!cancelled) {
          setAdminOrders(mapAdminOrders(data?.data?.orders ?? []));
          const pag = data?.data?.pagination || {};
          setOrdersPagination({
            total: pag.total || 0,
            totalPages: pag.totalPages || 1,
            page: pag.page || 1,
            limit: pag.limit || 20
          });
        }
      } catch (error) {
        if (!cancelled) {
          setOrdersError(error?.message || 'Impossible de charger les commandes.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingOrders(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, ordersCurrentPage, ordersPerPage, orderStatusFilter, orderDateFilter, orderClientFilter]);

  // Reset de la page quand un filtre change
  useEffect(() => {
    setOrdersCurrentPage(1);
  }, [orderStatusFilter, orderDateFilter, orderClientFilter]);

  // Réinitialiser tous les filtres
  function resetOrderFilters() {
    setOrderStatusFilter('');
    setOrderDateFilter('');
    setOrderClientFilter('');
    setOrdersCurrentPage(1);
  }

  // Ouvrir la modal détail d'une commande
  async function openOrderDetail(orderId) {
    setSelectedOrder(null);
    setSelectedNewStatus('');
    setOrderDetailError(null);
    setIsLoadingOrderDetail(true);
    try {
      const res = await apiFetch(`/api/admin/orders/${orderId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || 'Erreur lors de la récupération du détail');
      }
      const order = data?.data;
      setSelectedOrder({
        ...order,
        items: (order?.items || []).map((item) => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          price: parseFloat(item.price),
          total: parseFloat(item.total || (item.price * item.quantity))
        })),
        customer: order?.user?.name || order?.shippingAddress?.fullName || '',
        email: order?.user?.email || ''
      });
      // Pré-sélectionner la première transition disponible
      if (order?.availableTransitions?.length > 0) {
        setSelectedNewStatus(order.availableTransitions[0]);
      }
    } catch (error) {
      const message = error?.message || 'Impossible de charger le détail de la commande.';
      setOrderDetailError(message);
      // La fenêtre ne s'ouvre pas sans commande : sans ce toast, l'erreur restait invisible
      toast.error(message);
    } finally {
      setIsLoadingOrderDetail(false);
    }
  }

  // Confirmer le changement de statut
  async function handleConfirmStatusChange() {
    if (!selectedOrder || !selectedNewStatus) return;
    setIsUpdatingStatus(true);
    try {
      const res = await apiFetch(`/api/admin/orders/${selectedOrder.orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newStatus: selectedNewStatus })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || 'Erreur lors du changement de statut');
      }
      toast.success(`Statut de la commande mis à jour vers "${STATUS_LABELS[selectedNewStatus]}"`);
      // Rafraîchir le détail et la liste
      await openOrderDetail(selectedOrder.orderId);
      await loadAdminOrders();
    } catch (error) {
      toast.error(error?.message || 'Erreur lors du changement de statut');
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  // Formatage d'une date pour l'affichage
  function formatDate(date) {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

// Badge de statut coloré (FonctionnalitéHaute#427)
  function getOrderStatusBadge(status) {
    const label = STATUS_LABELS[status] || status || 'En attente de paiement';
    const color = STATUS_BADGES[status] || 'bg-gray-100 text-gray-700';
    return <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${color}`}>{label}</span>;
  }

// ─────────────────────────────────────────────
  // Gestion des clients (FonctionnalitéMoyenne#428)
  // ─────────────────────────────────────────────

  // Badge de statut du compte client (vert=actif, gris=désactivé)
  function getUserStatusBadge(isActive) {
    return isActive ? (
      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">Actif</span>
    ) : (
      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">Désactivé</span>
    );
  }

  // Rafraîchir la liste des clients (avec recherche + pagination)
  async function loadAdminUsers() {
    setIsLoadingUsers(true);
    setUsersError(null);
    try {
      const params = new URLSearchParams({
        page: usersCurrentPage,
        limit: usersPerPage
      });
      if (userSearchFilter.trim()) params.set('search', userSearchFilter.trim());

      const res = await apiFetch(`/api/admin/users?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || 'Erreur lors de la récupération des clients');
      }
      setAdminUsers(data?.data?.users ?? []);
      const pag = data?.data?.pagination || {};
      setUsersPagination({
        total: pag.total || 0,
        totalPages: pag.totalPages || 1,
        page: pag.page || 1,
        limit: pag.limit || 20
      });
    } catch (error) {
      setUsersError(error?.message || 'Impossible de charger les clients.');
    } finally {
      setIsLoadingUsers(false);
    }
  }

  // Fetch des clients quand on ouvre le tab ou change de filtre/page
  useEffect(() => {
    if (activeTab !== 'clients') return;
    let cancelled = false;
    (async () => {
      setIsLoadingUsers(true);
      setUsersError(null);
      try {
        const params = new URLSearchParams({
          page: usersCurrentPage,
          limit: usersPerPage
        });
        if (userSearchFilter.trim()) params.set('search', userSearchFilter.trim());

        const res = await apiFetch(`/api/admin/users?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.message || 'Erreur lors de la récupération des clients');
        }
        if (!cancelled) {
          setAdminUsers(data?.data?.users ?? []);
          const pag = data?.data?.pagination || {};
          setUsersPagination({
            total: pag.total || 0,
            totalPages: pag.totalPages || 1,
            page: pag.page || 1,
            limit: pag.limit || 20
          });
        }
      } catch (error) {
        if (!cancelled) {
          setUsersError(error?.message || 'Impossible de charger les clients.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingUsers(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, usersCurrentPage, usersPerPage, userSearchFilter]);

  // Reset de la page quand la recherche change
  useEffect(() => {
    setUsersCurrentPage(1);
  }, [userSearchFilter]);

  // Réinitialiser la recherche clients
  function resetUserFilters() {
    setUserSearchFilter('');
    setUsersCurrentPage(1);
  }

  // Ouvrir la modal profil d'un client
  async function openUserDetail(userId) {
    setSelectedUser(null);
    setUserOrderStatusFilter('');
    setUserDetailError(null);
    setIsLoadingUserDetail(true);
    try {
      const res = await apiFetch(`/api/admin/users/${userId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || 'Erreur lors de la récupération du profil client');
      }
      const detail = data?.data;
      setSelectedUser({
        ...detail,
        user: {
          ...(detail?.user || {}),
          createdAt: detail?.user?.createdAt
        }
      });
    } catch (error) {
      setUserDetailError(error?.message || 'Impossible de charger le profil du client.');
    } finally {
      setIsLoadingUserDetail(false);
    }
  }

  // Confirmer la désactivation / réactivation d'un compte client
  async function handleToggleUserActive() {
    if (!deactivateConfirmUser) return;
    const userId = deactivateConfirmUser.id;
    const targetActive = deactivateConfirmUser.isActive;
    setIsUpdatingUserActive(true);
    try {
      const endpoint = targetActive
        ? `/api/admin/users/${userId}/deactivate`
        : `/api/admin/users/${userId}/reactivate`;
      const res = await apiFetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || 'Erreur lors de la mise à jour du compte');
      }
      toast.success(targetActive ? 'Compte client désactivé avec succès' : 'Compte client réactivé avec succès');
      // Fermer la modal de confirmation
      setDeactivateConfirmUser(null);
      // Rafraîchir la liste
      await loadAdminUsers();
      // Rafraîchir le profil affiché si le client était sélectionné
      if (selectedUser?.user?.id === userId) {
        await openUserDetail(userId);
      }
    } catch (error) {
      toast.error(error?.message || 'Erreur lors de la mise à jour du compte');
    } finally {
      setIsUpdatingUserActive(false);
    }
  }

  // Rafraîchir la liste des produits (après création/édition)
  async function refreshProducts() {
      try {
          const res = await apiFetch('/api/admin/products?includeInactive=true');
          const data = await res.json();
          if (res.ok) {
              setProducts(data?.data?.products ?? []);
          }
} catch (error) {
          console.log('Erreur lors du rafraîchissement des produits:', error);
      }
  }

  // Suppression d'un produit (appelé depuis la modal de confirmation)
  async function handleDeleteProduct() {
      if (!deleteConfirmProduct) return;
      setIsDeletingProduct(true);
      try {
          const res = await apiFetch(`/api/admin/products/${deleteConfirmProduct.id}`, {
              method: 'DELETE'
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
              throw new Error(data?.message || 'Erreur lors de la suppression du produit');
          }
          toast.success('Produit supprimé avec succès');
          // Fermer la modal et réinitialiser l'état
          setDeleteConfirmProduct(null);
          // Recharger la liste à jour
          await refreshProducts();
          // Si la page courante devient vide après suppression, revenir à la page précédente
          if (processedProducts.pageItems.length === 1 && productsCurrentPage > 1) {
              setProductsCurrentPage(prev => Math.max(1, prev - 1));
          }
      } catch (error) {
          toast.error(error?.message || 'Erreur lors de la suppression du produit');
      } finally {
          setIsDeletingProduct(false);
      }
  }

  useEffect(() => {
      async function loadProducts() {
          try {
              const res = await fetch('/api/products');
              const data = await res.json();
              // Correction du bug : data est { success, data: { products, stats } }
              setProductsCount(data?.data?.products?.length ?? 0);
          } catch (error) {
              console.log(error);
          }
      }
      loadProducts();
  }, []);

  // Fetch des produits admin (protégé JWT)
  useEffect(() => {
      if (activeTab !== 'products') return;

      let cancelled = false;
      async function loadAdminProducts() {
          setIsLoadingProducts(true);
          setProductsError(null);
          try {
              const res = await apiFetch('/api/admin/products?includeInactive=true');
              const data = await res.json();
              if (!res.ok) {
                  throw new Error(data?.message || 'Erreur lors de la récupération des produits');
              }
              if (!cancelled) {
                  setProducts(data?.data?.products ?? []);
              }
          } catch (error) {
              if (!cancelled) {
                  setProductsError(error?.message || 'Impossible de charger les produits.');
              }
          } finally {
              if (!cancelled) {
                  setIsLoadingProducts(false);
              }
          }
      }
      loadAdminProducts();
      return () => { cancelled = true; };
  }, [activeTab]);

// Reset de la page quand la recherche ou le tri change
  useEffect(() => {
      setProductsCurrentPage(1);
  }, [productSearch, productSort]);

  // Rafraîchir la liste des catégories (après création/édition/suppression)
  async function refreshCategories() {
      try {
          const res = await apiFetch('/api/admin/categories');
          const data = await res.json();
          if (res.ok) {
              setCategories(data?.data?.categories ?? []);
          }
      } catch (error) {
          console.log('Erreur lors du rafraîchissement des catégories:', error);
      }
  }

  // Suppression d'une catégorie (appelé depuis la modal de confirmation)
  async function handleDeleteCategory() {
      if (!deleteConfirmCategory) return;
      setIsDeletingCategory(true);
      try {
          const res = await apiFetch(`/api/admin/categories/${deleteConfirmCategory.id}`, {
              method: 'DELETE'
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
              throw new Error(data?.message || 'Erreur lors de la suppression de la catégorie');
          }
          toast.success('Catégorie supprimée avec succès');
          // Fermer la modal et réinitialiser l'état
          setDeleteConfirmCategory(null);
          // Recharger la liste à jour
          await refreshCategories();
      } catch (error) {
          toast.error(error?.message || 'Erreur lors de la suppression de la catégorie');
      } finally {
          setIsDeletingCategory(false);
      }
  }

  // Fetch des catégories admin (protégé JWT)
  useEffect(() => {
      if (activeTab !== 'categories') return;

      let cancelled = false;
      async function loadAdminCategories() {
          setIsLoadingCategories(true);
          setCategoriesError(null);
          try {
              const res = await apiFetch('/api/admin/categories');
              const data = await res.json();
              if (!res.ok) {
                  throw new Error(data?.message || 'Erreur lors de la récupération des catégories');
              }
              if (!cancelled) {
                  setCategories(data?.data?.categories ?? []);
              }
          } catch (error) {
              if (!cancelled) {
                  setCategoriesError(error?.message || 'Impossible de charger les catégories.');
              }
          } finally {
              if (!cancelled) {
                  setIsLoadingCategories(false);
              }
          }
      }
loadAdminCategories();
      return () => { cancelled = true; };
  }, [activeTab]);

  // ─────────────────────────────────────────────
  // Fetch des analytics (chiffre d'affaires + top produits)
  // ─────────────────────────────────────────────

  // Charger l'évolution du chiffre d'affaires selon la période sélectionnée
  useEffect(() => {
    if (activeTab !== 'analytics') return;
    let cancelled = false;
    (async () => {
      setIsLoadingRevenue(true);
      setRevenueError(null);
      try {
        const res = await apiFetch(`/api/admin/analytics/revenue?period=${revenuePeriod}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.message || 'Erreur lors de la récupération des analytics');
        }
        if (!cancelled) {
          setRevenueData({
            series: data?.data?.series ?? [],
            totalRevenue: data?.data?.totalRevenue ?? 0,
            totalOrders: data?.data?.totalOrders ?? 0
          });
        }
      } catch (error) {
        if (!cancelled) {
          setRevenueError(error?.message || 'Impossible de charger les analytics.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingRevenue(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, revenuePeriod]);

  // Charger le top produits (indépendant de la période)
  useEffect(() => {
    if (activeTab !== 'analytics') return;
    let cancelled = false;
    (async () => {
      setIsLoadingTopProducts(true);
      setTopProductsError(null);
      try {
        const res = await apiFetch('/api/admin/analytics/top-products?limit=10');
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.message || 'Erreur lors de la récupération du top produits');
        }
        if (!cancelled) {
          setTopProducts(data?.data?.products ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          setTopProductsError(error?.message || 'Impossible de charger le top produits.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingTopProducts(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab]);

// ─────────────────────────────────────────────
  // Rafraîchir les métriques + dernières commandes du tableau de bord (FonctionnalitéHaute#429)
  // ─────────────────────────────────────────────
  async function refreshDashboardMetrics() {
    // Recharger les métriques du tableau de bord
    setIsLoadingMetrics(true);
    setMetricsError(null);
    try {
      const res = await apiFetch('/api/admin/dashboard/metrics');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || 'Erreur lors de la récupération des métriques');
      }
      if (data?.data) {
        setDashboardMetrics({
          totalRevenue: data.data.totalRevenue ?? 0,
          todayOrdersCount: data.data.todayOrdersCount ?? 0,
          newCustomersCount: data.data.newCustomersCount ?? 0,
          outOfStockCount: data.data.outOfStockCount ?? 0,
          lowStockProducts: data.data.lowStockProducts ?? []
        });
      }
    } catch (error) {
      setMetricsError(error?.message || 'Impossible de charger les métriques.');
    } finally {
      setIsLoadingMetrics(false);
    }

    // Recharger les 10 dernières commandes
    setIsLoadingRecentOrders(true);
    setRecentOrdersError(null);
    try {
      const res = await apiFetch('/api/admin/dashboard/recent-orders');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || 'Erreur lors de la récupération des dernières commandes');
      }
      setRecentOrders(mapAdminOrders(data?.data?.orders ?? []));
    } catch (error) {
      setRecentOrdersError(error?.message || 'Impossible de charger les dernières commandes.');
    } finally {
      setIsLoadingRecentOrders(false);
    }
  }

  // ─────────────────────────────────────────────
  // Fetch des métriques précises du tableau de bord (FonctionnalitéHaute#429)
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'dashboard') return;
    let cancelled = false;
    (async () => {
      setIsLoadingMetrics(true);
      setMetricsError(null);
      try {
        const res = await apiFetch('/api/admin/dashboard/metrics');
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.message || 'Erreur lors de la récupération des métriques');
        }
        if (!cancelled && data?.data) {
          setDashboardMetrics({
            totalRevenue: data.data.totalRevenue ?? 0,
            todayOrdersCount: data.data.todayOrdersCount ?? 0,
            newCustomersCount: data.data.newCustomersCount ?? 0,
            outOfStockCount: data.data.outOfStockCount ?? 0,
            lowStockProducts: data.data.lowStockProducts ?? []
          });
        }
      } catch (error) {
        if (!cancelled) {
          setMetricsError(error?.message || 'Impossible de charger les métriques.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingMetrics(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab]);

  // ─────────────────────────────────────────────
  // Fetch des 10 dernières commandes (FonctionnalitéHaute#429)
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'dashboard') return;
    let cancelled = false;
    (async () => {
      setIsLoadingRecentOrders(true);
      setRecentOrdersError(null);
      try {
        const res = await apiFetch('/api/admin/dashboard/recent-orders');
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.message || 'Erreur lors de la récupération des dernières commandes');
        }
        if (!cancelled) {
          // Réutilise mapAdminOrders pour un affichage homogène avec le tab Commandes
          setRecentOrders(mapAdminOrders(data?.data?.orders ?? []));
        }
      } catch (error) {
        if (!cancelled) {
          setRecentOrdersError(error?.message || 'Impossible de charger les dernières commandes.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingRecentOrders(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab]);


  // Indicateur de stock : vert/orange/rouge
  const getStockIndicator = (stock) => {
      if (stock > 10) return { color: 'green', label: 'En stock' };
      if (stock >= 1 && stock <= 10) return { color: 'orange', label: 'Stock limité' };
      return { color: 'red', label: 'Rupture de stock' };
  };

  // Produits filtrés (recherche) → triés → paginés
  const processedProducts = useMemo(() => {
      // 1. Recherche par nom (insensible à la casse)
      let list = products;
      if (productSearch.trim()) {
          const q = productSearch.trim().toLowerCase();
          list = list.filter(p => (p.name || '').toLowerCase().includes(q));
      }

      // 2. Tri
      const sorted = [...list];
      switch (productSort) {
          case 'price-asc':
              sorted.sort((a, b) => a.price - b.price);
              break;
          case 'price-desc':
              sorted.sort((a, b) => b.price - a.price);
              break;
          case 'stock-asc':
              sorted.sort((a, b) => a.stock - b.stock);
              break;
          case 'stock-desc':
              sorted.sort((a, b) => b.stock - a.stock);
              break;
          case 'date-asc':
              sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
              break;
          case 'date-desc':
          default:
              sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
              break;
      }

      // 3. Pagination
      const totalPages = Math.max(1, Math.ceil(sorted.length / productsPerPage));
      const currentPage = Math.min(productsCurrentPage, totalPages);
      const startIndex = (currentPage - 1) * productsPerPage;
      const pageItems = sorted.slice(startIndex, startIndex + productsPerPage);

      return { pageItems, total: sorted.length, totalPages, currentPage };
  }, [products, productSearch, productSort, productsPerPage, productsCurrentPage]);

  useEffect(() => {
      function handleClickOutside(event) {
          if (notifRef.current && !notifRef.current.contains(event.target)) {
              setShowNotifs(false);
          }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

// Statistiques basées sur les commandes réelles chargées depuis l'API admin
  const totalRevenue = adminOrders.reduce((sum, order) => sum + (order.total || 0), 0);
  const totalOrders = adminOrders.length;
  const uniqueCustomers = new Set(adminOrders.map(order => order.email || order.customer || order.address)).size;

  const stats = [
    { title: "Revenu Total", value: `${totalRevenue.toFixed(2)} €`, change: "+12.5%", isPositive: true, icon: DollarSign },
    { title: "Commandes", value: totalOrders.toString(), change: "+5.2%", isPositive: true, icon: ShoppingBag },
    { title: "Clients uniques", value: uniqueCustomers.toString(), change: "+2.4%", isPositive: true, icon: Users },
    { title: "Produits en catalogue", value: productsCount.toString(), change: "Actif", isPositive: true, icon: Package },
  ];

  const pendingOrders = adminOrders.filter(o => o._status === "pending");

  const getStatusBadge = (status) => {
    switch(status) {
      case 'Livré': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">Livré</span>;
      case 'En attente de paiement': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700">En attente de paiement</span>;
      case 'En transit': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">En transit</span>;
      case 'Annulé': return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">Annulé</span>;
      default: return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">{status || "En attente de paiement"}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      
      <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col h-screen sticky top-0">
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <Link to="/" className="text-xl font-extrabold text-indigo-600 flex items-center gap-2">
            <Package className="text-indigo-600" />
            AdminPro
          </Link>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-1">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
            <LayoutDashboard size={20} /> Vue d'ensemble
          </button>
<button onClick={() => setActiveTab('orders')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors ${activeTab === 'orders' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
            <ShoppingBag size={20} /> Commandes
            {pendingOrders.length > 0 && (
                <span className="ml-auto bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
                    {pendingOrders.length}
                </span>
            )}
          </button>
<button onClick={() => setActiveTab('products')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors ${activeTab === 'products' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
            <Package size={20} /> Produits
          </button>
<button onClick={() => setActiveTab('categories')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors ${activeTab === 'categories' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
            <FolderTree size={20} /> Catégories
          </button>
<button onClick={() => setActiveTab('clients')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors ${activeTab === 'clients' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
            <Users size={20} /> Clients
          </button>
          <button onClick={() => setActiveTab('analytics')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors ${activeTab === 'analytics' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
            <BarChart3 size={20} /> Analytics
          </button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-20">
          <div className="flex items-center gap-4 flex-1">
             <h2 className="text-lg font-bold text-gray-800">Interface Administrateur</h2>
          </div>
          <div className="flex items-center gap-5">
            
            <div className="relative" ref={notifRef}>
              <button 
                onClick={() => setShowNotifs(!showNotifs)}
                className="relative p-2 text-gray-400 hover:text-indigo-600 transition-colors"
              >
                <Bell size={20} />
                {pendingOrders.length > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[9px] text-white font-bold">
                        {pendingOrders.length}
                    </span>
                )}
              </button>

              {showNotifs && (
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-900">Notifications</h3>
                    <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-full">{pendingOrders.length} nouvelles</span>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {pendingOrders.length === 0 ? (
                      <div className="p-6 text-center text-gray-500 text-sm">
                        Aucune nouvelle notification.
                      </div>
                    ) : (
                      pendingOrders.map((notif, idx) => (
                        <div key={idx} className="p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors flex gap-3 cursor-pointer" onClick={() => {setActiveTab('orders'); setShowNotifs(false);}}>
                           <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                              <ShoppingBag size={18} className="text-indigo-600" />
                           </div>
                           <div>
                             <p className="text-sm font-semibold text-gray-900">Nouvelle commande ({notif.id})</p>
                             <p className="text-xs text-gray-500 mt-1">{notif.customer || "Client"} a passé une commande de {notif.total.toFixed(2)}€.</p>
                             <p className="text-xs text-indigo-600 mt-2 font-medium">{notif.date}</p>
                           </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              AD
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6 md:p-8">
          
      
{activeTab === 'dashboard' && (
              <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in">
                <div className="flex justify-between items-end">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
                    <p className="text-gray-500 text-sm mt-1">Vos statistiques en temps réel basées sur les ventes.</p>
                  </div>
<button
                    onClick={refreshDashboardMetrics}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
                  >
                    <RefreshCw size={16} />
                    Actualiser
                  </button>
                </div>

                {/* Bandeaux d'alerte stock (FonctionnalitéHaute#429) */}
                {!isOutOfStockAlertDismissed && dashboardMetrics.outOfStockCount > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle size={20} className="text-red-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-red-700">Rupture de stock</h3>
                        <p className="text-sm text-red-600 mt-0.5">
                          {dashboardMetrics.outOfStockCount === 1
                            ? '1 produit est en rupture de stock.'
                            : `${dashboardMetrics.outOfStockCount} produits sont en rupture de stock.`}{' '}
                          <button onClick={() => setActiveTab('products')} className="font-semibold underline hover:text-red-800">
                            Consulter le catalogue
                          </button>
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setIsOutOfStockAlertDismissed(true)} className="p-1 text-red-400 hover:text-red-700 transition-colors" aria-label="Fermer">
                      <X size={18} />
                    </button>
                  </div>
                )}

                {!isLowStockAlertDismissed && dashboardMetrics.lowStockProducts.length > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                        <Package size={20} className="text-orange-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-orange-700">Stock faible</h3>
                        <p className="text-sm text-orange-600 mt-0.5">
                          {dashboardMetrics.lowStockProducts.length === 1
                            ? '1 produit a un stock faible.'
                            : `${dashboardMetrics.lowStockProducts.length} produits ont un stock faible.`}{' '}
                          <button onClick={() => setActiveTab('products')} className="font-semibold underline hover:text-orange-800">
                            Réapprovisionner
                          </button>
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {dashboardMetrics.lowStockProducts.slice(0, 5).map((p) => (
                            <span key={p.id} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-white border border-orange-200 text-orange-700">
                              {p.name} <span className="text-orange-500">({p.stock})</span>
                            </span>
                          ))}
                          {dashboardMetrics.lowStockProducts.length > 5 && (
                            <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-white border border-orange-200 text-orange-600">
                              +{dashboardMetrics.lowStockProducts.length - 5} autres
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setIsLowStockAlertDismissed(true)} className="p-1 text-orange-400 hover:text-orange-700 transition-colors" aria-label="Fermer">
                      <X size={18} />
                    </button>
                  </div>
                )}

                {isLoadingMetrics ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm animate-pulse">
                        <div className="w-10 h-10 rounded-xl bg-gray-100 mb-4"></div>
                        <div className="h-3 bg-gray-100 rounded w-24 mb-2"></div>
                        <div className="h-6 bg-gray-100 rounded w-32"></div>
                      </div>
                    ))}
                  </div>
                ) : metricsError ? (
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
                    <AlertTriangle size={20} className="text-red-500" />
                    <p className="text-sm text-gray-600">{metricsError}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Revenu total */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center mb-4">
                        <DollarSign size={20} className="text-indigo-600" />
                      </div>
                      <h3 className="text-gray-500 text-sm font-medium">Revenu total</h3>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {dashboardMetrics.totalRevenue.toFixed(2)} €
                      </p>
                    </div>

                    {/* Commandes aujourd'hui */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center mb-4">
                        <ShoppingBag size={20} className="text-indigo-600" />
                      </div>
                      <h3 className="text-gray-500 text-sm font-medium">Commandes aujourd'hui</h3>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{dashboardMetrics.todayOrdersCount}</p>
                    </div>

                    {/* Nouveaux clients */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center mb-4">
                        <UserPlus size={20} className="text-indigo-600" />
                      </div>
                      <h3 className="text-gray-500 text-sm font-medium">Nouveaux clients</h3>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{dashboardMetrics.newCustomersCount}</p>
                    </div>

                    {/* Ruptures de stock */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center mb-4">
                        <AlertTriangle size={20} className="text-indigo-600" />
                      </div>
                      <h3 className="text-gray-500 text-sm font-medium">Ruptures de stock</h3>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{dashboardMetrics.outOfStockCount}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1 space-y-6">
                    <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-1 relative overflow-hidden shadow-xl h-full">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/30 rounded-full blur-3xl"></div>
                      <div className="bg-white/10 backdrop-blur-md rounded-[22px] p-6 relative h-full border border-white/10">
                        <div className="flex items-center gap-2 mb-6">
                          <Sparkles className="text-indigo-300" size={24} />
                          <h2 className="text-lg font-bold text-white">Insights IA</h2>
                        </div>

                        <div className="space-y-4">
                            {totalOrders === 0 ? (
                                <p className="text-sm text-indigo-200/70">L'IA analysera vos données dès votre première vente !</p>
                            ) : (
                                <>
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                      <h3 className="text-sm font-semibold text-indigo-100 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-green-400"></span>
                                        Ventes en hausse
                                      </h3>
                                      <p className="text-sm text-indigo-200/70 mt-2">
                                        Vous avez réalisé {totalOrders} commande(s) pour {totalRevenue.toFixed(2)} €. Continuez ainsi !
                                      </p>
                                    </div>
                                    {pendingOrders.length > 0 && (
                                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 cursor-pointer hover:bg-white/10 transition-colors" onClick={() => setActiveTab('orders')}>
                                          <h3 className="text-sm font-semibold text-indigo-100 flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span>
                                            Action Requise
                                          </h3>
                                          <p className="text-sm text-indigo-200/70 mt-2">
                                            Vous avez {pendingOrders.length} commande(s) en attente. Cliquez ici pour les gérer.
                                          </p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-2">
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden h-full flex flex-col">
                      <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-gray-900">Commandes Récentes</h2>
                        <button onClick={() => setActiveTab('orders')} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors">Voir tout</button>
                      </div>

                      <div className="overflow-x-auto flex-1">
                        {isLoadingRecentOrders ? (
                            <div className="p-10 text-center flex flex-col items-center">
                              <Loader2 size={28} className="text-indigo-500 animate-spin mb-3" />
                              <p className="text-gray-500 text-sm">Chargement des commandes...</p>
                            </div>
                        ) : recentOrdersError ? (
                            <div className="p-10 text-center text-gray-500 text-sm">{recentOrdersError}</div>
                        ) : recentOrders.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">Aucune commande pour le moment.</div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Commande</th>
                                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Client</th>
                                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Statut</th>
                                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {recentOrders.slice(0, 5).map((order) => (
                                  <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 font-semibold text-indigo-600 text-sm">
                                        {/* Fenêtre de détail admin : /order-detail ne montre que les commandes de l'utilisateur connecté */}
                                        <button type="button" onClick={() => openOrderDetail(order.orderId || order.id)} className="hover:underline">
                                          {order.id}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{order.customer || "Client"}</td>
                                    <td className="px-6 py-4">{getStatusBadge(order.status)}</td>
                                    <td className="px-6 py-4 text-sm font-bold text-gray-900">{order.total.toFixed(2)} €</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                        )}
                      </div>
                    </div>
                  </div>

                </div>

                {/* Liste complète des 10 dernières commandes (FonctionnalitéHaute#429) */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-900">30 dernières commandes</h2>
                    <button onClick={() => setActiveTab('orders')} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors">Voir tout</button>
                  </div>
                  <div className="overflow-x-auto">
                    {isLoadingRecentOrders ? (
                      <div className="p-12 text-center flex flex-col items-center">
                        <Loader2 size={32} className="text-indigo-500 animate-spin mb-3" />
                        <p className="text-gray-500 text-sm">Chargement des commandes...</p>
                      </div>
                    ) : recentOrdersError ? (
                      <div className="p-12 text-center text-gray-500 text-sm">{recentOrdersError}</div>
                    ) : recentOrders.length === 0 ? (
                      <div className="p-12 text-center text-gray-500">Aucune commande pour le moment.</div>
                    ) : (
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">ID Commande</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Client</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Statut</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Articles</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Total</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {recentOrders.map((order) => (
                            <tr key={order.id} className="hover:bg-gray-50/50 transition-colors group">
                              <td className="px-6 py-4 font-semibold text-indigo-600 text-sm">{order.id}</td>
                              <td className="px-6 py-4">
                                <div className="text-sm font-medium text-gray-900">{order.customer || "Client Privé"}</div>
                                <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[160px]">{order.email}</div>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">{order.date}</td>
                              <td className="px-6 py-4">{getOrderStatusBadge(order._status)}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {order.itemsCount} {order.itemsCount > 1 ? 'articles' : 'article'}
                              </td>
                              <td className="px-6 py-4 text-sm font-bold text-gray-900">{order.total.toFixed(2)} €</td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  onClick={() => openOrderDetail(order.orderId)}
                                  className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                  <Eye size={14} />
                                  Voir détail
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
          )}

         
          {activeTab === 'orders' && (
              <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in">
                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Toutes les commandes</h1>
                    <p className="text-gray-500 text-sm mt-1">Gérez et suivez l'ensemble des commandes de votre boutique.</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                      {/* Filtre par statut */}
                      <div className="relative">
                          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                          <select
                              value={orderStatusFilter}
                              onChange={(e) => setOrderStatusFilter(e.target.value)}
                              className="pl-10 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 shadow-sm appearance-none cursor-pointer"
                          >
                              <option value="">Tous les statuts</option>
                              <option value="pending">En attente de paiement</option>
                              <option value="confirmed">Confirmée</option>
                              <option value="processing">En préparation</option>
                              <option value="shipped">Expédiée</option>
                              <option value="delivered">Livrée</option>
                              <option value="cancelled">Annulée</option>
                          </select>
                      </div>

                      {/* Filtre par date */}
                      <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                          <input
                              type="date"
                              value={orderDateFilter}
                              onChange={(e) => setOrderDateFilter(e.target.value)}
                              className="pl-10 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 shadow-sm"
                          />
                      </div>

                      {/* Recherche par client (email / nom) */}
                      <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                          <input
                              type="text"
                              value={orderClientFilter}
                              onChange={(e) => setOrderClientFilter(e.target.value)}
                              placeholder="Client (email / nom)..."
                              className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 w-full sm:w-56 shadow-sm"
                          />
                      </div>

{/* Réinitialiser les filtres (affiché uniquement si au moins un filtre est actif) */}
                      {(orderStatusFilter || orderDateFilter || orderClientFilter.trim()) && (
                          <button
                              onClick={resetOrderFilters}
                              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
                          >
                              <RefreshCw size={16} />
                              Réinitialiser
                          </button>
                      )}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        {isLoadingOrders ? (
                            <div className="p-20 text-center flex flex-col items-center">
                                <Loader2 size={40} className="text-indigo-500 animate-spin mb-4" />
                                <h3 className="text-lg font-bold text-gray-900">Chargement des commandes...</h3>
                                <p className="text-gray-500 mt-2">Veuillez patienter.</p>
                            </div>
                        ) : ordersError ? (
                            <div className="p-20 text-center flex flex-col items-center">
                                <X size={40} className="text-red-400 mb-4" />
                                <h3 className="text-lg font-bold text-gray-900">Erreur de chargement</h3>
                                <p className="text-gray-500 mt-2">{ordersError}</p>
                            </div>
                        ) : adminOrders.length === 0 ? (
                            <div className="p-20 text-center flex flex-col items-center">
                                <ShoppingBag size={48} className="text-gray-300 mb-4" />
                                <h3 className="text-xl font-bold text-gray-900">Aucune commande trouvée</h3>
                                <p className="text-gray-500 mt-2">Aucune commande ne correspond à votre recherche.</p>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">ID Commande</th>
                                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Client</th>
                                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Statut</th>
                                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Articles</th>
                                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Total</th>
                                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {adminOrders.map((order) => (
                                  <tr key={order.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-6 py-4 font-semibold text-indigo-600 text-sm">{order.id}</td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-gray-900">{order.customer || "Client Privé"}</div>
                                        <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[160px]">{order.email}{!order.email && order.address ? ` • ${order.address}` : ''}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{order.date}</td>
                                    <td className="px-6 py-4">{getOrderStatusBadge(order._status)}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        {order.itemsCount} {order.itemsCount > 1 ? 'articles' : 'article'}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-bold text-gray-900">{order.total.toFixed(2)} €</td>
                                    <td className="px-6 py-4 text-right">
                                      <button
                                          onClick={() => openOrderDetail(order.orderId)}
                                          className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                                      >
                                          <Eye size={14} />
                                          Voir détail
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {!isLoadingOrders && !ordersError && ordersPagination.total > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <p className="text-sm text-gray-500">
                            Affichage de <span className="font-semibold text-gray-900">{adminOrders.length}</span> commandes
                            {orderStatusFilter || orderDateFilter || orderClientFilter.trim() ? (
                                <> sur <span className="font-semibold text-gray-900">{ordersPagination.total}</span> résultat(s)</>
                            ) : (
                                <> (total <span className="font-semibold text-gray-900">{ordersPagination.total}</span>)</>
                            )}
                        </p>
                        <div className="flex items-center gap-2">
                            <select
                                value={ordersPerPage}
                                onChange={(e) => setOrdersPerPage(Number(e.target.value))}
                                className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 shadow-sm cursor-pointer"
                            >
                                <option value={10}>10 / page</option>
                                <option value={20}>20 / page</option>
                                <option value={50}>50 / page</option>
                            </select>
                            <button
                                onClick={() => setOrdersCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={ordersCurrentPage <= 1}
                                className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Précédent
                            </button>
                            <span className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl">
                                Page {ordersPagination.page} / {ordersPagination.totalPages}
                            </span>
                            <button
                                onClick={() => setOrdersCurrentPage(prev => Math.min(ordersPagination.totalPages, prev + 1))}
                                disabled={ordersCurrentPage >= ordersPagination.totalPages}
                                className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Suivant
                            </button>
                        </div>
                    </div>
                )}
              </div>
          )}

{activeTab === 'products' && (
              <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in">
                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestion des produits</h1>
                    <p className="text-gray-500 text-sm mt-1">Recherchez, triez et gérez l'ensemble de votre catalogue.</p>
                  </div>
                  
                  <div className="flex flex-wrap gap-3">
                      <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                          <input 
                              type="text" 
                              value={productSearch}
                              onChange={(e) => setProductSearch(e.target.value)}
                              placeholder="Rechercher un produit..."
                              className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 w-full sm:w-64 shadow-sm"
                          />
                      </div>
                      <div className="relative">
                          <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                          <select
                              value={productSort}
                              onChange={(e) => setProductSort(e.target.value)}
                              className="pl-10 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 shadow-sm appearance-none cursor-pointer"
                          >
                              <option value="date-desc">Plus récents</option>
                              <option value="date-asc">Plus anciens</option>
                              <option value="price-desc">Prix décroissant</option>
                              <option value="price-asc">Prix croissant</option>
                              <option value="stock-desc">Stock décroissant</option>
                              <option value="stock-asc">Stock croissant</option>
                          </select>
                      </div>
<select
                          value={productsPerPage}
                          onChange={(e) => setProductsPerPage(Number(e.target.value))}
                          className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 shadow-sm cursor-pointer"
                      >
                          <option value={10}>10 / page</option>
                          <option value={15}>15 / page</option>
                          <option value={20}>20 / page</option>
                      </select>
                      <button
                          onClick={() => {
                              setEditingProduct(null);
                              setProductModalOpen(true);
                          }}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm"
                      >
                          <Plus size={16} />
                          Ajouter un produit
                      </button>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        {isLoadingProducts ? (
                            <div className="p-20 text-center flex flex-col items-center">
                                <Loader2 size={40} className="text-indigo-500 animate-spin mb-4" />
                                <h3 className="text-lg font-bold text-gray-900">Chargement des produits...</h3>
                                <p className="text-gray-500 mt-2">Veuillez patienter.</p>
                            </div>
                        ) : productsError ? (
                            <div className="p-20 text-center flex flex-col items-center">
                                <X size={40} className="text-red-400 mb-4" />
                                <h3 className="text-lg font-bold text-gray-900">Erreur de chargement</h3>
                                <p className="text-gray-500 mt-2">{productsError}</p>
                            </div>
                        ) : processedProducts.pageItems.length === 0 ? (
                            <div className="p-20 text-center flex flex-col items-center">
                                <Package size={48} className="text-gray-300 mb-4" />
                                <h3 className="text-xl font-bold text-gray-900">Aucun produit trouvé</h3>
                                <p className="text-gray-500 mt-2">Aucun produit ne correspond à votre recherche.</p>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
<th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Produit</th>
                                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Catégorie</th>
                                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Prix</th>
                                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Stock</th>
                                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Statut</th>
                                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {processedProducts.pageItems.map((product) => {
                                    const indicator = getStockIndicator(product.stock);
                                    const indicatorStyles = {
                                        green: 'bg-green-100 text-green-700',
                                        orange: 'bg-orange-100 text-orange-700',
                                        red: 'bg-red-100 text-red-700'
                                    };
                                    return (
                                        <tr key={product.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    {product.images && product.images.length > 0 ? (
                                                        <img 
                                                            src={product.images[0]} 
                                                            alt={product.name}
                                                            className="w-10 h-10 rounded-lg object-cover border border-gray-100 flex-shrink-0"
                                                            onError={(e) => { e.target.style.display = 'none'; }}
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                                            <Package size={18} className="text-gray-400" />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-semibold text-gray-900 truncate max-w-[220px]">{product.name}</div>
                                                        <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[220px]">{product.description || ''}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{product.category?.name || "Sans catégorie"}</td>
                                            <td className="px-6 py-4 text-sm font-bold text-gray-900">{parseFloat(product.price).toFixed(2)} €</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${indicatorStyles[indicator.color]}`}>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                                    {indicator.label} ({product.stock})
                                                </span>
                                            </td>
<td className="px-6 py-4">
                                                {product.isActive ? (
                                                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">Actif</span>
                                                ) : (
                                                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">Inactif</span>
                                                )}
                                            </td>
<td className="px-6 py-4 text-right">
                                              <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => {
                                                        setEditingProduct(product);
                                                        setProductModalOpen(true);
                                                    }}
                                                    className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                                                >
                                                    <Pencil size={14} />
                                                    Modifier
                                                </button>
                                                <button
                                                    onClick={() => setDeleteConfirmProduct(product)}
                                                    className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                    Supprimer
                                                </button>
                                              </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                              </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {!isLoadingProducts && !productsError && processedProducts.total > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <p className="text-sm text-gray-500">
                            Affichage de <span className="font-semibold text-gray-900">{processedProducts.pageItems.length}</span> produits
                            {productSearch.trim() && (
                                <> • <span className="font-semibold text-gray-900">{processedProducts.total}</span> résultat(s) pour "<span className="text-indigo-600">{productSearch.trim()}</span>"</>
                            )}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setProductsCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={processedProducts.currentPage <= 1}
                                className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Précédent
                            </button>
                            <span className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl">
                                Page {processedProducts.currentPage} / {processedProducts.totalPages}
                            </span>
                            <button
                                onClick={() => setProductsCurrentPage(prev => Math.min(processedProducts.totalPages, prev + 1))}
                                disabled={processedProducts.currentPage >= processedProducts.totalPages}
                                className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Suivant
                            </button>
                        </div>
                    </div>
)}
              </div>
          )}

{activeTab === 'categories' && (
              <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in">
                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestion des catégories</h1>
                    <p className="text-gray-500 text-sm mt-1">Créez, renommez et organisez vos catégories de produits.</p>
                  </div>
                  
                  <button
                      onClick={() => {
                          setEditingCategory(null);
                          setCategoryModalOpen(true);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm"
                  >
                      <Plus size={16} />
                      Ajouter une catégorie
                  </button>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        {isLoadingCategories ? (
                            <div className="p-20 text-center flex flex-col items-center">
                                <Loader2 size={40} className="text-indigo-500 animate-spin mb-4" />
                                <h3 className="text-lg font-bold text-gray-900">Chargement des catégories...</h3>
                                <p className="text-gray-500 mt-2">Veuillez patienter.</p>
                            </div>
                        ) : categoriesError ? (
                            <div className="p-20 text-center flex flex-col items-center">
                                <X size={40} className="text-red-400 mb-4" />
                                <h3 className="text-lg font-bold text-gray-900">Erreur de chargement</h3>
                                <p className="text-gray-500 mt-2">{categoriesError}</p>
                            </div>
                        ) : categories.length === 0 ? (
                            <div className="p-20 text-center flex flex-col items-center">
                                <FolderTree size={48} className="text-gray-300 mb-4" />
                                <h3 className="text-xl font-bold text-gray-900">Aucune catégorie</h3>
                                <p className="text-gray-500 mt-2">Commencez par ajouter une catégorie.</p>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Nom</th>
                                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Description</th>
                                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Nombre de produits</th>
                                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {categories.map((cat) => (
                                  <tr key={cat.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                                          <Tag size={18} className="text-indigo-600" />
                                        </div>
                                        <div className="text-sm font-semibold text-gray-900">{cat.name}</div>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600 max-w-[300px] truncate">{cat.description || '—'}</td>
                                    <td className="px-6 py-4">
                                      {cat.productCount > 0 ? (
                                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-700">
                                              {cat.productCount} produit{cat.productCount > 1 ? 's' : ''}
                                          </span>
                                      ) : (
                                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-500">
                                              0 produit
                                          </span>
                                      )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                      <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => {
                                                setEditingCategory(cat);
                                                setCategoryModalOpen(true);
                                            }}
                                            className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                                        >
                                            <Pencil size={14} />
                                            Modifier
                                        </button>
                                        <button
                                            onClick={() => setDeleteConfirmCategory(cat)}
                                            className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={14} />
                                            Supprimer
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                        )}
                    </div>
                </div>

{!isLoadingCategories && !categoriesError && categories.length > 0 && (
                    <p className="text-sm text-gray-500">
                        Affichage de <span className="font-semibold text-gray-900">{categories.length}</span> catégorie(s)
                    </p>
                )}
              </div>
          )}

          {activeTab === 'clients' && (
              <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in">
                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestion des clients</h1>
                    <p className="text-gray-500 text-sm mt-1">Consultez les profils clients et gérez l'activation de leurs comptes.</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                      {/* Recherche par nom / email */}
                      <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                          <input
                              type="text"
                              value={userSearchFilter}
                              onChange={(e) => setUserSearchFilter(e.target.value)}
                              placeholder="Rechercher (nom / email)..."
                              className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 w-full sm:w-64 shadow-sm"
                          />
                      </div>

                      {/* Réinitialiser la recherche */}
                      {userSearchFilter.trim() && (
                          <button
                              onClick={resetUserFilters}
                              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
                          >
                              <RefreshCw size={16} />
                              Réinitialiser
                          </button>
                      )}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        {isLoadingUsers ? (
                            <div className="p-20 text-center flex flex-col items-center">
                                <Loader2 size={40} className="text-indigo-500 animate-spin mb-4" />
                                <h3 className="text-lg font-bold text-gray-900">Chargement des clients...</h3>
                                <p className="text-gray-500 mt-2">Veuillez patienter.</p>
                            </div>
                        ) : usersError ? (
                            <div className="p-20 text-center flex flex-col items-center">
                                <X size={40} className="text-red-400 mb-4" />
                                <h3 className="text-lg font-bold text-gray-900">Erreur de chargement</h3>
                                <p className="text-gray-500 mt-2">{usersError}</p>
                            </div>
                        ) : adminUsers.length === 0 ? (
                            <div className="p-20 text-center flex flex-col items-center">
                                <Users size={48} className="text-gray-300 mb-4" />
                                <h3 className="text-xl font-bold text-gray-900">Aucun client trouvé</h3>
                                <p className="text-gray-500 mt-2">Aucun client ne correspond à votre recherche.</p>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Nom</th>
                                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Email</th>
                                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date d'inscription</th>
                                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Commandes</th>
                                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Statut</th>
                                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {adminUsers.map((user) => (
                                  <tr key={user.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                      <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                                          <Users size={16} className="text-indigo-600" />
                                        </div>
                                        <div className="text-sm font-semibold text-gray-900">{user.name || 'Client'}</div>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{formatDate(user.createdAt)}</td>
                                    <td className="px-6 py-4">
                                      {user.ordersCount > 0 ? (
                                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-700">
                                              {user.ordersCount} commande{user.ordersCount > 1 ? 's' : ''}
                                          </span>
                                      ) : (
                                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-500">
                                              Aucune commande
                                          </span>
                                      )}
                                    </td>
                                    <td className="px-6 py-4">{getUserStatusBadge(user.isActive)}</td>
                                    <td className="px-6 py-4 text-right">
                                      <button
                                          onClick={() => openUserDetail(user.id)}
                                          className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                                      >
                                          <Eye size={14} />
                                          Voir profil
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
</table>
                        )}
                    </div>
                </div>

                {!isLoadingUsers && !usersError && usersPagination.total > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
<p className="text-sm text-gray-500">
                            Affichage de <span className="font-semibold text-gray-900">{adminUsers.length}</span> client(s)
                            {userSearchFilter.trim() ? (
                                <> sur <span className="font-semibold text-gray-900">{usersPagination.total}</span> résultat(s)</>
                            ) : (
                                <> (total <span className="font-semibold text-gray-900">{usersPagination.total}</span>)</>
                            )}
                        </p>
                        <div className="flex items-center gap-2">
                            <select
                                value={usersPerPage}
                                onChange={(e) => setUsersPerPage(Number(e.target.value))}
                                className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 shadow-sm cursor-pointer"
                            >
                                <option value={10}>10 / page</option>
                                <option value={20}>20 / page</option>
                                <option value={50}>50 / page</option>
                            </select>
                            <button
                                onClick={() => setUsersCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={usersCurrentPage <= 1}
                                className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Précédent
                            </button>
                            <span className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl">
                                Page {usersPagination.page} / {usersPagination.totalPages}
                            </span>
                            <button
                                onClick={() => setUsersCurrentPage(prev => Math.min(usersPagination.totalPages, prev + 1))}
                                disabled={usersCurrentPage >= usersPagination.totalPages}
                                className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Suivant
                            </button>
                        </div>
                    </div>
                )}
              </div>
          )}

          {activeTab === 'analytics' && (
              <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in">
                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
                    <p className="text-gray-500 text-sm mt-1">
                      Suivez l'évolution de votre chiffre d'affaires et identifiez vos produits les plus performants.
                    </p>
                  </div>

                  {/* Sélecteur de période */}
                  <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-xl shadow-sm">
                    {[
                      { value: '7d', label: '7 jours' },
                      { value: '30d', label: '30 jours' },
                      { value: '12m', label: '12 mois' }
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setRevenuePeriod(opt.value)}
                        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                          revenuePeriod === opt.value
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cartes récapitulatives */}
                {!isLoadingRevenue && !revenueError && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center mb-4">
                        <DollarSign size={20} className="text-indigo-600" />
                      </div>
                      <h3 className="text-gray-500 text-sm font-medium">Chiffre d'affaires total</h3>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{revenueData.totalRevenue.toFixed(2)} €</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center mb-4">
                        <ShoppingBag size={20} className="text-indigo-600" />
                      </div>
                      <h3 className="text-gray-500 text-sm font-medium">Commandes (non annulées)</h3>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{revenueData.totalOrders}</p>
                    </div>
                  </div>
                )}

                {/* Évolution du chiffre d'affaires */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900">Évolution du chiffre d'affaires</h2>
                    <p className="text-gray-500 text-sm mt-1">
                      {revenuePeriod === '7d' ? '7 derniers jours' : revenuePeriod === '30d' ? '30 derniers jours' : '12 derniers mois'}
                    </p>
                  </div>
                  <div className="p-6">
                    {isLoadingRevenue ? (
                      <div className="py-16 text-center flex flex-col items-center">
                        <Loader2 size={40} className="text-indigo-500 animate-spin mb-4" />
                        <h3 className="text-lg font-bold text-gray-900">Chargement des données...</h3>
                      </div>
                    ) : revenueError ? (
                      <div className="py-16 text-center flex flex-col items-center">
                        <X size={40} className="text-red-400 mb-4" />
                        <h3 className="text-lg font-bold text-gray-900">Erreur de chargement</h3>
                        <p className="text-gray-500 mt-2">{revenueError}</p>
                      </div>
                    ) : revenueData.series.length === 0 ? (
                      <div className="py-16 text-center flex flex-col items-center">
                        <BarChart3 size={48} className="text-gray-300 mb-4" />
                        <h3 className="text-xl font-bold text-gray-900">Aucune donnée</h3>
                        <p className="text-gray-500 mt-2">Aucune vente sur cette période.</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={320}>
                        <LineChart data={revenueData.series} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6b7280' }} />
                          <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
<Tooltip
                            formatter={(value) => [`${value} €`, 'Chiffre d\u0027affaires']}
                            contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '14px' }}
                          />
                          <Legend />
                          <Line type="monotone" dataKey="revenue" name="CA" stroke="#4f46e5" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Top produits les plus vendus */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900">Top produits les plus vendus</h2>
                    <p className="text-gray-500 text-sm mt-1">Classement basé sur la quantité vendue, toutes périodes confondues.</p>
                  </div>
                  <div className="p-6">
                    {isLoadingTopProducts ? (
                      <div className="py-16 text-center flex flex-col items-center">
                        <Loader2 size={40} className="text-indigo-500 animate-spin mb-4" />
                        <h3 className="text-lg font-bold text-gray-900">Chargement du classement...</h3>
                      </div>
                    ) : topProductsError ? (
                      <div className="py-16 text-center flex flex-col items-center">
                        <X size={40} className="text-red-400 mb-4" />
                        <h3 className="text-lg font-bold text-gray-900">Erreur de chargement</h3>
                        <p className="text-gray-500 mt-2">{topProductsError}</p>
                      </div>
                    ) : topProducts.length === 0 ? (
                      <div className="py-16 text-center flex flex-col items-center">
                        <Package size={48} className="text-gray-300 mb-4" />
                        <h3 className="text-xl font-bold text-gray-900">Aucun produit vendu</h3>
                        <p className="text-gray-500 mt-2">Dès la première vente, le classement apparaîtra ici.</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={Math.max(80, topProducts.length * 48)}>
                        <BarChart data={topProducts} layout="vertical" margin={{ top: 0, right: 40, left: 20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} allowDecimals={false} />
                          <YAxis type="category" dataKey="name" width={200} tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(name) => (name.length > 25 ? `${name.slice(0, 25)}…` : name)} />
                          <Tooltip
                            formatter={(value, name) => (name === 'quantitySold' ? [`${value}`, 'Quantité vendue'] : [`${value} €`, 'Revenu'])}
                            contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '14px' }}
                          />
                          <Legend />
                          <Bar dataKey="quantitySold" name="Quantité vendue" fill="#4f46e5" radius={[0, 6, 6, 0]} barSize={24} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>
          )}

</div>
      </main>
{/* Modal de création / édition de produit */}
      <ProductFormModal
        isOpen={productModalOpen}
        onClose={() => setProductModalOpen(false)}
        product={editingProduct}
        onSuccess={refreshProducts}
      />

      {/* Modal de confirmation de suppression de produit */}
      <ConfirmDeleteModal
        isOpen={!!deleteConfirmProduct}
        title="Supprimer ce produit ?"
        entityName={`« ${deleteConfirmProduct?.name || ''} »`}
        message={
          <>
            Vous êtes sur le point de supprimer{' '}
            <span className="font-semibold text-gray-900">« {deleteConfirmProduct?.name || ''} »</span> du catalogue.
          </>
        }
        warning="Cette action est irréversible. Le produit sera définitivement supprimé du catalogue."
        isDeleting={isDeletingProduct}
        onClose={() => setDeleteConfirmProduct(null)}
        onConfirm={handleDeleteProduct}
      />

      {/* Modal de création / édition de catégorie */}
      <CategoryFormModal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        category={editingCategory}
        onSuccess={refreshCategories}
      />

      {/* Modal de confirmation de suppression de catégorie */}
      <ConfirmDeleteModal
        isOpen={!!deleteConfirmCategory}
        title="Supprimer cette catégorie ?"
        entityName={deleteConfirmCategory?.name || ''}
        message={
          deleteConfirmCategory && deleteConfirmCategory.productCount > 0 ? (
            `Cette catégorie contient ${deleteConfirmCategory.productCount} produit(s). La suppression est impossible tant que des produits y sont rattachés. Veuillez d'abord réassigner ou supprimer ces produits.`
          ) : (
            `Êtes-vous sûr de vouloir supprimer la catégorie « ${deleteConfirmCategory?.name || ''} » ?`
          )
        }
        warning={
          deleteConfirmCategory && deleteConfirmCategory.productCount > 0
            ? 'Suppression impossible : des produits sont liés à cette catégorie.'
            : 'Cette action est irréversible.'
        }
confirmDisabled={
          !!(deleteConfirmCategory && deleteConfirmCategory.productCount > 0)
        }
        isDeleting={isDeletingCategory}
        onClose={() => setDeleteConfirmCategory(null)}
        onConfirm={handleDeleteCategory}
      />

      {/* Modal de détail d'une commande (FonctionnalitéHaute#427) */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedOrder(null)} />

          {/* Contenu du modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* En-tête */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <ShoppingBag size={18} className="text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Commande {selectedOrder.orderId}</h2>
                  <p className="text-xs text-gray-500">
                    {selectedOrder.customer || "Client"} {selectedOrder.email && `• ${selectedOrder.email}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Corps du modal */}
            <div className="flex-1 overflow-y-auto p-6">
              {isLoadingOrderDetail ? (
                <div className="p-10 text-center flex flex-col items-center">
                  <Loader2 size={32} className="text-indigo-500 animate-spin mb-3" />
                  <p className="text-gray-500 text-sm">Chargement du détail...</p>
                </div>
              ) : orderDetailError ? (
                <div className="p-10 text-center flex flex-col items-center">
                  <X size={32} className="text-red-400 mb-3" />
                  <h3 className="text-lg font-bold text-gray-900">Erreur de chargement</h3>
                  <p className="text-gray-500 mt-2 text-sm">{orderDetailError}</p>
                </div>
              ) : (
                <>
                  {/* Statut + changement de statut */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100 mb-6">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Statut actuel</p>
                      <div className="flex items-center gap-2">
                        {getOrderStatusBadge(selectedOrder.status)}
                        {selectedOrder.trackingNumber && (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                            <Truck size={14} className="text-gray-400" />
                            {selectedOrder.trackingNumber}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      {selectedOrder.availableTransitions?.length > 0 ? (
                        <>
                          <select
                            value={selectedNewStatus}
                            onChange={(e) => setSelectedNewStatus(e.target.value)}
                            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 shadow-sm cursor-pointer"
                          >
                            {selectedOrder.availableTransitions.map((t) => (
                              <option key={t} value={t}>{STATUS_LABELS[t] || t}</option>
                            ))}
                          </select>
                          <button
                            onClick={handleConfirmStatusChange}
                            disabled={!selectedNewStatus || isUpdatingStatus}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isUpdatingStatus ? (
                              <>
                                <Loader2 size={16} className="animate-spin" />
                                Mise à jour...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 size={16} />
                                Confirmer le changement
                              </>
                            )}
                          </button>
                        </>
                      ) : (
                        <span className="text-sm text-gray-500">Statut final — aucun changement possible</span>
                      )}
                    </div>
                  </div>

                  {/* Produits commandés */}
                  <div className="mb-6">
                    <h3 className="text-sm font-bold text-gray-900 mb-3">Produits commandés</h3>
                    <div className="overflow-hidden border border-gray-200 rounded-xl">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Produit</th>
                            <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-center">Qté</th>
                            <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Prix unitaire</th>
                            <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Sous-total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {(selectedOrder.items || []).map((item, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/50">
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.name}</td>
                              <td className="px-4 py-3 text-sm text-gray-600 text-center">{item.quantity}</td>
                              <td className="px-4 py-3 text-sm text-gray-600 text-right">{item.price.toFixed(2)} €</td>
                              <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">{item.total.toFixed(2)} €</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-50 border-t border-gray-100">
                            <td colSpan="3" className="px-4 py-3 text-sm font-bold text-gray-700 text-right">Total</td>
                            <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                              {parseFloat(selectedOrder.totalAmount || 0).toFixed(2)} €
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

{/* Adresse de livraison + paiement */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-3">Adresse de livraison & paiement</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1.5">
                          <MapPin size={14} className="text-gray-400" />
                          Adresse de livraison
                        </p>
                        <p className="text-sm font-medium text-gray-900">
                          {selectedOrder.shippingAddress?.fullName || ''}
                        </p>
                        <p className="text-sm text-gray-600">
                          {selectedOrder.shippingAddress?.address || '—'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {selectedOrder.shippingAddress?.postalCode ? `${selectedOrder.shippingAddress.postalCode} ` : ''}
                          {selectedOrder.shippingAddress?.city || '—'}
                        </p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1.5">
                          <CreditCard size={14} className="text-gray-400" />
                          Paiement
                        </p>
                        <p className="text-sm font-medium text-gray-900">
                          {selectedOrder.paymentMethod || '—'}
                        </p>
                      </div>
                    </div>
</div>

                  {/* Historique des états (cahier 03, §3.1) */}
                  {selectedOrder.statusHistory?.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
                        <History size={16} className="text-gray-400" />
                        Historique des états
                      </h3>
                      <ol className="relative border-l border-gray-200 ml-2 space-y-4">
                        {selectedOrder.statusHistory.map((entry, index) => (
                          <li key={index} className="ml-4">
                            <span className={`absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full border-2 border-white ${STATUS_BADGES[entry.toStatus] || 'bg-gray-100'}`} />
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGES[entry.toStatus] || 'bg-gray-100 text-gray-700'}`}>
                                {STATUS_LABELS[entry.toStatus] || entry.toStatus}
                              </span>
                              {entry.fromStatus ? (
                                <span className="text-xs text-gray-400">depuis « {STATUS_LABELS[entry.fromStatus] || entry.fromStatus} »</span>
                              ) : (
                                <span className="text-xs text-gray-400">création de la commande</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(entry.changedAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
                              {' • '}
                              {entry.changedBy
                                ? `${entry.changedBy.name || entry.changedBy.email}${entry.changedBy.role === 'admin' ? ' (admin)' : ''}`
                                : 'Système'}
                            </p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmation de désactivation / réactivation d'un client (FonctionnalitéMoyenne#428) */}
      <ConfirmDeleteModal
        isOpen={!!deactivateConfirmUser}
        title={deactivateConfirmUser?.isActive ? 'Désactiver ce compte ?' : 'Réactiver ce compte ?'}
        entityName={deactivateConfirmUser?.name || ''}
        message={
          deactivateConfirmUser?.isActive
            ? `Êtes-vous sûr de vouloir désactiver le compte de « ${deactivateConfirmUser?.name || 'ce client'} » ? Il ne pourra plus se connecter.`
            : `Êtes-vous sûr de vouloir réactiver le compte de « ${deactivateConfirmUser?.name || 'ce client'} » ?`
        }
        warning={
          deactivateConfirmUser?.isActive
            ? 'Cette action empêchera le client de se connecter à son compte.'
            : 'Le client pourra de nouveau se connecter à son compte.'
        }
        isDeleting={isUpdatingUserActive}
        onClose={() => setDeactivateConfirmUser(null)}
        onConfirm={handleToggleUserActive}
      />

      {/* Modal de détail profil client (FonctionnalitéMoyenne#428) */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedUser(null)} />

          {/* Contenu du modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* En-tête */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <Users size={18} className="text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{selectedUser.user?.name || 'Client'}</h2>
                  <p className="text-xs text-gray-500">
                    {selectedUser.user?.email}
                    {' • '}
                    {getUserStatusBadge(selectedUser.user?.isActive)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Corps du modal */}
            <div className="flex-1 overflow-y-auto p-6">
              {isLoadingUserDetail ? (
                <div className="p-10 text-center flex flex-col items-center">
                  <Loader2 size={32} className="text-indigo-500 animate-spin mb-3" />
                  <p className="text-gray-500 text-sm">Chargement du profil...</p>
                </div>
              ) : userDetailError ? (
                <div className="p-10 text-center flex flex-col items-center">
                  <X size={32} className="text-red-400 mb-3" />
                  <h3 className="text-lg font-bold text-gray-900">Erreur de chargement</h3>
                  <p className="text-gray-500 mt-2 text-sm">{userDetailError}</p>
                </div>
              ) : (
                <>
                  {/* Informations personnelles */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Nom</p>
                      <p className="text-sm font-bold text-gray-900">{selectedUser.user?.name || '—'}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Email</p>
                      <p className="text-sm font-bold text-gray-900 truncate">{selectedUser.user?.email || '—'}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Inscrit le</p>
                      <p className="text-sm font-bold text-gray-900">{formatDate(selectedUser.user?.createdAt)}</p>
                    </div>
                  </div>

                  {/* Statistiques */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                      <p className="text-xs font-semibold text-indigo-500 uppercase mb-1">Total dépensé</p>
                      <p className="text-xl font-bold text-indigo-700">
                        {parseFloat(selectedUser.totalSpent || 0).toFixed(2)} €
                      </p>
                    </div>
                    <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                      <p className="text-xs font-semibold text-indigo-500 uppercase mb-1">Nombre de commandes</p>
                      <p className="text-xl font-bold text-indigo-700">{selectedUser.ordersCount || 0}</p>
                    </div>
                  </div>

                  {/* Historique des commandes du client */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-gray-900">Historique des commandes</h3>
                      {/* Filtre par statut */}
                      <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <select
                          value={userOrderStatusFilter}
                          onChange={(e) => setUserOrderStatusFilter(e.target.value)}
                          className="pl-8 pr-6 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500 shadow-sm appearance-none cursor-pointer"
                        >
                          <option value="">Tous les statuts</option>
                          <option value="pending">En attente de paiement</option>
                          <option value="confirmed">Confirmée</option>
                          <option value="processing">En préparation</option>
                          <option value="shipped">Expédiée</option>
                          <option value="delivered">Livrée</option>
                          <option value="cancelled">Annulée</option>
                        </select>
                      </div>
                    </div>

                    {(selectedUser.orders || []).length === 0 ? (
                      <div className="p-8 text-center text-gray-500 border border-gray-200 rounded-xl">
                        Aucune commande pour ce client.
                      </div>
                    ) : (
                      <div className="overflow-hidden border border-gray-200 rounded-xl">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Commande</th>
                              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Statut</th>
                              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {(selectedUser.orders || [])
                              .filter((order) => !userOrderStatusFilter || order.status === userOrderStatusFilter)
                              .map((order) => (
                                <tr key={order.id} className="hover:bg-gray-50/50">
                                  <td className="px-4 py-3 font-semibold text-indigo-600 text-sm">{order.orderId}</td>
                                  <td className="px-4 py-3 text-sm text-gray-600">{formatDate(order.createdAt)}</td>
                                  <td className="px-4 py-3">{getOrderStatusBadge(order.status)}</td>
                                  <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                                    {parseFloat(order.totalAmount || 0).toFixed(2)} €
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Boutons d'action : désactiver / réactiver */}
                  {currentAdmin?.id !== selectedUser.user?.id && (
                    <div className="flex justify-end pt-4 border-t border-gray-100">
                      {selectedUser.user?.isActive ? (
                        <button
                          onClick={() => setDeactivateConfirmUser({ ...selectedUser.user, isActive: true })}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm"
                        >
                          <Power size={16} />
                          Désactiver le compte
                        </button>
                      ) : (
                        <button
                          onClick={() => setDeactivateConfirmUser({ ...selectedUser.user, isActive: false })}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors shadow-sm"
                        >
                          <RotateCcw size={16} />
                          Réactiver le compte
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
