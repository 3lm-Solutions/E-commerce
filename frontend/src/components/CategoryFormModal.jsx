import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { X, Plus, Loader2 } from 'lucide-react';
import { apiFetch } from '../lib/api';

/**
 * Schéma de validation Zod reprenant les règles du backend
 * - name : 2-100 caractères
 * - description : max 500
 */
const categorySchema = z.object({
  name: z.string().trim().min(2, 'Le nom doit contenir au moins 2 caractères').max(100, 'Le nom ne peut pas dépasser 100 caractères'),
  description: z.string().trim().max(500, 'La description ne peut pas dépasser 500 caractères').optional().or(z.literal(''))
});

function CategoryFormModal({ isOpen, onClose, category, onSuccess }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nameError, setNameError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      description: ''
    }
  });

  // Pré-remplissage en mode édition
  useEffect(() => {
    if (!isOpen) return;
    if (category) {
      reset({
        name: category.name || '',
        description: category.description || ''
      });
    } else {
      // Mode création : formulaire vierge
      reset({
        name: '',
        description: ''
      });
    }
    setNameError('');
    clearErrors();
  }, [isOpen, category, reset, clearErrors]);

  /**
   * Soumission : POST (création) ou PUT (édition)
   */
  async function onSubmit(values) {
    setIsSubmitting(true);
    setNameError('');
    try {
      const payload = {
        name: values.name,
        description: values.description || null
      };

      const isEdit = !!category;
      const url = isEdit ? `/api/admin/categories/${category.id}` : '/api/admin/categories';
      const res = await apiFetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      // Gestion spécifique du 409 (nom déjà utilisé) : afficher sur le champ name
      if (res.status === 409) {
        const message = data?.message || 'Ce nom de catégorie existe déjà';
        setNameError(message);
        setError('name', { type: 'manual', message });
        return;
      }

      if (!res.ok) {
        throw new Error(data?.message || 'Erreur lors de l\'enregistrement de la catégorie');
      }

      toast.success(isEdit ? 'Catégorie mise à jour avec succès' : 'Catégorie créée avec succès');
      onSuccess && onSuccess();
      onClose();
    } catch (error) {
      toast.error(error?.message || 'Erreur lors de l\'enregistrement de la catégorie');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Contenu du modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* En-tête */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {category ? 'Modifier la catégorie' : 'Ajouter une catégorie'}
          </h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Corps du formulaire */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6">
          {/* Nom */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nom de la catégorie <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex : Électronique"
              {...register('name')}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-colors"
            />
            {nameError && <p className="mt-1 text-xs text-red-500">{nameError}</p>}
            {errors.name && !nameError && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
          </div>

          {/* Description */}
          <div className="mt-5">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Description <span className="text-gray-400 text-xs">(optionnel)</span>
            </label>
            <textarea
              rows={4}
              placeholder="Description de la catégorie..."
              {...register('description')}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-colors resize-none"
            />
            {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description.message}</p>}
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
                  {category ? 'Enregistrer' : 'Créer la catégorie'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CategoryFormModal;
