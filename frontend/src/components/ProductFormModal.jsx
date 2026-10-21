import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { X, Plus, Loader2, ImagePlus, Trash2, Sparkles } from 'lucide-react';
import { apiFetch, CHATBOT_URL } from '../lib/api';

/**
 * Schéma de validation Zod reprenant les règles du backend
 * - name : 2-200 caractères
 * - description : max 2000
 * - price : positif
 * - stock : entier positif par défaut 0
 * - categoryId : requis (UUID)
 * - images : max 10
 * - tags : max 20
 * - isActive : booléen
 */
const productSchema = z.object({
  name: z.string().trim().min(2, 'Le nom doit contenir au moins 2 caractères').max(200, 'Le nom ne peut pas dépasser 200 caractères'),
  description: z.string().trim().max(2000, 'La description ne peut pas dépasser 2000 caractères').optional().or(z.literal('')),
  price: z.coerce.number().positive('Le prix doit être un nombre positif'),
  stock: z.coerce.number().int('Le stock doit être un nombre entier').min(0, 'Le stock ne peut pas être négatif').default(0),
  categoryId: z.string().min(1, 'Veuillez sélectionner une catégorie'),
  isActive: z.boolean()
});

const MAX_IMAGES = 10;
const MAX_TAGS = 20;

function ProductFormModal({ isOpen, onClose, product, onSuccess }) {
  const [categories, setCategories] = useState([]);
  const [images, setImages] = useState([]);           // URLs uploadées
  const [uploading, setUploading] = useState(false);  // état upload en cours
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [tags, setTags] = useState([]);               // liste des tags (chips)
  const [tagInput, setTagInput] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      description: '',
      price: '',
      stock: 0,
      categoryId: '',
      isActive: true
    }
  });

  // Chargement des catégories
  useEffect(() => {
    let cancelled = false;
    async function loadCategories() {
      try {
        const res = await fetch('/api/categories');
        const data = await res.json();
        if (!cancelled) {
          setCategories(data?.data?.categories ?? []);
        }
      } catch (error) {
        toast.error('Impossible de charger les catégories.');
      }
    }
    if (isOpen) loadCategories();
    return () => { cancelled = true; };
  }, [isOpen]);

  // Pré-remplissage en mode édition
  useEffect(() => {
    if (!isOpen) return;
    if (product) {
      reset({
        name: product.name || '',
        description: product.description || '',
        price: product.price ?? '',
        stock: product.stock ?? 0,
        categoryId: product.category?.id || product.categoryId || '',
        isActive: product.isActive ?? true
      });
      setImages(product.images || []);
      setTags(product.tags || []);
    } else {
      // Mode création : formulaire vierge
      reset({
        name: '',
        description: '',
        price: '',
        stock: 0,
        categoryId: '',
        isActive: true
      });
      setImages([]);
      setTags([]);
    }
    setTagInput('');
  }, [isOpen, product, reset]);

  /**
   * Upload d'une image sélectionnée (fire au moment de la sélection)
   */
  async function handleFileChange(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Vérifier la limite de 10 images
    if (images.length + files.length > MAX_IMAGES) {
      toast.error(`Maximum ${MAX_IMAGES} images par produit.`);
      e.target.value = '';
      return;
    }

    setUploading(true);
    try {
      const uploadedUrls = [];

      for (const file of files) {
        const formData = new FormData();
        formData.append('image', file);

        const res = await apiFetch('/api/admin/products/upload-image', {
          method: 'POST',
          body: formData
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.message || 'Erreur lors de l\'upload de l\'image');
        }

        uploadedUrls.push(data?.data?.url);
      }

      setImages(prev => [...prev, ...uploadedUrls].slice(0, MAX_IMAGES));
      toast.success(files.length > 1 ? 'Images uploadées avec succès' : 'Image uploadée avec succès');
    } catch (error) {
      toast.error(error?.message || 'Erreur lors de l\'upload de l\'image');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

// Supprimer une image de la liste (avant envoi)
  function removeImage(url) {
    setImages(prev => prev.filter(img => img !== url));
  }

  // Ajouter un tag (saisie + Entrée ou virgule)
  function addTag() {
    const value = tagInput.trim().replace(/,+$/, '');
    if (!value) return;
    if (tags.length >= MAX_TAGS) {
      toast.error(`Maximum ${MAX_TAGS} tags par produit.`);
      return;
    }
    if (!tags.includes(value)) {
      const newTags = [...tags, value];
      setTags(newTags);
    }
    setTagInput('');
  }

  function handleTagKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
  }

  function removeTag(tag) {
    setTags(prev => prev.filter(t => t !== tag));
  }

  /**
   * Génère une description produit via le backend chatbot IA (POST /ai/generate-description)
   * puis remplit le textarea description (valeur éditable).
   */
  async function handleGenerateDescription() {
    const name = (watch('name') || '').trim();
    const categoryId = watch('categoryId');
    const selectedCategory = categories.find(cat => cat.id === categoryId);
    const category = selectedCategory?.name?.trim() || '';

    if (!name || !category) {
      toast.error('Veuillez renseigner le nom et la catégorie avant de générer une description.');
      return;
    }

    setIsGeneratingDescription(true);
    try {
      const res = await fetch(`${CHATBOT_URL}/ai/generate-description`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, category, tags })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Impossible de générer la description.');
      }

      setValue('description', data.description || '', { shouldValidate: true });
      toast.success('Description générée avec succès. Vous pouvez la modifier avant d\'enregistrer.');
    } catch (error) {
      toast.error(error?.message || 'Impossible de générer la description.');
    } finally {
      setIsGeneratingDescription(false);
    }
  }

  /**
   * Soumission : POST (création) ou PUT (édition)
   */
  async function onSubmit(values) {
    setIsSubmitting(true);
    try {
      const payload = {
        name: values.name,
        description: values.description || null,
        price: parseFloat(values.price),
        stock: parseInt(values.stock, 10) || 0,
        categoryId: values.categoryId,
        images,
        tags,
        isActive: values.isActive
      };

      const isEdit = !!product;
      const url = isEdit ? `/api/admin/products/${product.id}` : '/api/admin/products';
      const res = await apiFetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || 'Erreur lors de l\'enregistrement du produit');
      }

      toast.success(isEdit ? 'Produit mis à jour avec succès' : 'Produit créé avec succès');
      onSuccess && onSuccess();
      onClose();
    } catch (error) {
      toast.error(error?.message || 'Erreur lors de l\'enregistrement du produit');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  // Valeurs actuelles pour prévisualisation (mode édition)
  const currentImages = images;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Contenu du modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* En-tête */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {product ? 'Modifier le produit' : 'Ajouter un produit'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Corps du formulaire */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Nom */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Nom du produit <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Ex : T-shirt en coton bio"
                {...register('name')}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-colors"
              />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
            </div>

{/* Description */}
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <button
                  type="button"
                  onClick={handleGenerateDescription}
                  disabled={isGeneratingDescription}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingDescription ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Génération...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      Générer description
                    </>
                  )}
                </button>
              </div>
              <textarea
                rows={3}
                placeholder="Description détaillée du produit..."
                {...register('description')}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-colors resize-none"
              />
              {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description.message}</p>}
            </div>

            {/* Prix */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Prix (€) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...register('price')}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-colors"
              />
              {errors.price && <p className="mt-1 text-xs text-red-500">{errors.price.message}</p>}
            </div>

            {/* Stock */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Stock</label>
              <input
                type="number"
                step="1"
                min="0"
                placeholder="0"
                {...register('stock')}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-colors"
              />
              {errors.stock && <p className="mt-1 text-xs text-red-500">{errors.stock.message}</p>}
            </div>

            {/* Catégorie */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Catégorie <span className="text-red-500">*</span>
              </label>
              <select
                {...register('categoryId')}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-colors bg-white cursor-pointer"
              >
                <option value="">Sélectionner une catégorie...</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              {errors.categoryId && <p className="mt-1 text-xs text-red-500">{errors.categoryId.message}</p>}
            </div>

            {/* Tags */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Tags <span className="text-gray-400 text-xs">({tags.length}/{MAX_TAGS})</span>
              </label>
              <div className="flex flex-wrap items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-colors">
                {tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-indigo-900"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={addTag}
                  placeholder={tags.length === 0 ? "Ajouter un tag puis Entrée..." : ""}
                  className="flex-1 min-w-[120px] text-sm outline-none"
                />
              </div>
            </div>

            {/* Statut actif/inactif */}
            <div className="md:col-span-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('isActive')}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700">Produit actif (visible sur le catalogue)</span>
              </label>
            </div>

            {/* Images */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Images <span className="text-gray-400 text-xs">({images.length}/{MAX_IMAGES})</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {/* Images existantes */}
                {currentImages.map((url, idx) => (
                  <div key={idx} className="relative group h-24 rounded-xl overflow-hidden border border-gray-200">
                    <img src={url} alt={`Image ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(url)}
                      className="absolute top-1 right-1 p-1 bg-white/90 rounded-full text-gray-600 hover:text-red-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                {/* Bouton d'upload */}
                <label className={`h-24 rounded-xl border-2 border-dashed border-gray-300 hover:border-indigo-500 hover:bg-indigo-50 flex flex-col items-center justify-center cursor-pointer transition-colors ${uploading ? 'pointer-events-none opacity-60' : ''}`}>
                  {uploading ? (
                    <Loader2 size={24} className="text-indigo-500 animate-spin" />
                  ) : (
                    <>
                      <ImagePlus size={24} className="text-gray-400 mb-1" />
                      <span className="text-xs text-gray-500 font-medium">Ajouter</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
              <p className="mt-1.5 text-xs text-gray-400">Formats acceptés : JPEG, PNG, WEBP. Taille max : 5 Mo par image.</p>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Plus size={16} />
                  {product ? 'Enregistrer' : 'Créer le produit'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProductFormModal;
