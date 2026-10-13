import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Eye, EyeOff, AlertCircle, Check, Info } from 'lucide-react';

/**
 * Input accessible avec validation en temps réel et feedback visuel
 */
export const AccessibleInput = ({
  label,
  type = 'text',
  value,
  onChange,
  error,
  success,
  hint,
  required = false,
  disabled = false,
  placeholder = '',
  className = '',
  autoComplete = 'off',
  maxLength,
  pattern,
  onValidate,
  showCharCount = false,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const inputId = useRef(`input-${Math.random().toString(36).substr(2, 9)}`);

  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;
  
  // États visuels
  const hasError = Boolean(error);
  const hasSuccess = Boolean(success);
  const hasValue = Boolean(value);

  // Validation en temps réel
  useEffect(() => {
    if (onValidate && value !== undefined) {
      onValidate(value);
    }
  }, [value, onValidate]);

  const handleFocus = (e) => {
    setFocused(true);
    props.onFocus?.(e);
  };

  const handleBlur = (e) => {
    setFocused(false);
    props.onBlur?.(e);
  };

  // Classes CSS conditionnelles
  const inputClasses = `
    w-full px-4 py-3 border rounded-xl transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
    disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
    ${hasError ? 'border-red-400 bg-red-50' : ''}
    ${hasSuccess ? 'border-green-400 bg-green-50' : ''}
    ${!hasError && !hasSuccess ? 'border-gray-200 hover:border-gray-300' : ''}
    ${focused ? 'ring-2 ring-indigo-500 ring-opacity-20' : ''}
    ${isPassword ? 'pr-12' : ''}
    ${className}
  `;

  const labelClasses = `
    block text-sm font-medium mb-2 transition-colors duration-200
    ${hasError ? 'text-red-700' : 'text-gray-700'}
    ${focused ? 'text-indigo-600' : ''}
  `;

  return (
    <div className="space-y-2">
      {/* Label avec indicateur requis */}
      {label && (
        <label htmlFor={inputId.current} className={labelClasses}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Conteneur input avec icônes */}
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId.current}
          type={inputType}
          value={value}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete={autoComplete}
          maxLength={maxLength}
          pattern={pattern}
          required={required}
          className={inputClasses}
          aria-invalid={hasError}
          aria-describedby={`${inputId.current}-help ${inputId.current}-error`}
          {...props}
        />

        {/* Bouton show/hide password */}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded p-1"
            aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            tabIndex={disabled ? -1 : 0}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}

        {/* Indicateur de validation */}
        {(hasError || hasSuccess) && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {hasError ? (
              <AlertCircle size={18} className="text-red-500" />
            ) : (
              <Check size={18} className="text-green-500" />
            )}
          </div>
        )}
      </div>

      {/* Zone d'aide et erreurs */}
      <div className="space-y-1">
        {/* Compteur de caractères */}
        {showCharCount && maxLength && (
          <div className="flex justify-end">
            <span className={`text-xs ${
              value?.length > maxLength * 0.8 
                ? value?.length >= maxLength 
                  ? 'text-red-500' 
                  : 'text-yellow-500'
                : 'text-gray-400'
            }`}>
              {value?.length || 0}/{maxLength}
            </span>
          </div>
        )}

        {/* Message d'erreur */}
        {error && (
          <div
            id={`${inputId.current}-error`}
            className="flex items-start gap-2 text-red-600 text-sm"
            role="alert"
            aria-live="polite"
          >
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Message de succès */}
        {success && !error && (
          <div className="flex items-start gap-2 text-green-600 text-sm">
            <Check size={14} className="flex-shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* Texte d'aide */}
        {hint && !error && (
          <div
            id={`${inputId.current}-help`}
            className="flex items-start gap-2 text-gray-500 text-sm"
          >
            <Info size={14} className="flex-shrink-0 mt-0.5" />
            <span>{hint}</span>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Conteneur de formulaire accessible avec gestion des erreurs
 */
export const AccessibleForm = ({
  onSubmit,
  children,
  errors = {},
  isSubmitting = false,
  className = '',
  ...props
}) => {
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setHasSubmitted(true);
    onSubmit?.(e);
  };

  // Annoncer les erreurs aux screen readers
  useEffect(() => {
    if (hasSubmitted && Object.keys(errors).length > 0) {
      const errorMessage = `Le formulaire contient ${Object.keys(errors).length} erreur${Object.keys(errors).length > 1 ? 's' : ''}`;
      
      // Créer un élément temporaire pour l'annonce
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'assertive');
      announcement.setAttribute('aria-atomic', 'true');
      announcement.className = 'sr-only';
      announcement.textContent = errorMessage;
      
      document.body.appendChild(announcement);
      
      setTimeout(() => {
        document.body.removeChild(announcement);
      }, 1000);
    }
  }, [hasSubmitted, errors]);

  return (
    <form
      onSubmit={handleSubmit}
      className={className}
      noValidate
      {...props}
    >
      {/* Résumé des erreurs en haut du formulaire */}
      {hasSubmitted && Object.keys(errors).length > 0 && (
        <div
          className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6"
          role="alert"
          aria-labelledby="error-summary-title"
        >
          <h3 id="error-summary-title" className="text-red-800 font-medium mb-2">
            Veuillez corriger les erreurs suivantes :
          </h3>
          <ul className="list-disc list-inside text-red-700 text-sm space-y-1">
            {Object.entries(errors).map(([field, error]) => (
              <li key={field}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {children}
    </form>
  );
};

/**
 * Groupe de champs pour organiser le formulaire
 */
export const FieldGroup = ({ 
  title, 
  description, 
  children, 
  className = '' 
}) => (
  <fieldset className={`space-y-4 ${className}`}>
    {title && (
      <legend className="text-lg font-medium text-gray-900 mb-4">
        {title}
      </legend>
    )}
    {description && (
      <p className="text-gray-600 text-sm mb-4">{description}</p>
    )}
    {children}
  </fieldset>
);

/**
 * Switch/Toggle accessible
 */
export const AccessibleSwitch = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className = ''
}) => {
  const switchId = useRef(`switch-${Math.random().toString(36).substr(2, 9)}`);

  return (
    <div className={`flex items-start space-x-3 ${className}`}>
      <button
        type="button"
        role="switch"
        id={switchId.current}
        aria-checked={checked}
        aria-describedby={description ? `${switchId.current}-desc` : undefined}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full transition-colors
          focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed
          ${checked ? 'bg-indigo-600' : 'bg-gray-200'}
        `}
      >
        <span
          className={`
            inline-block h-4 w-4 rounded-full bg-white transition-transform
            ${checked ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
      
      <div className="flex-1">
        <label
          htmlFor={switchId.current}
          className="text-sm font-medium text-gray-900 cursor-pointer"
        >
          {label}
        </label>
        {description && (
          <p
            id={`${switchId.current}-desc`}
            className="text-sm text-gray-500 mt-1"
          >
            {description}
          </p>
        )}
      </div>
    </div>
  );
};

// PropTypes
AccessibleInput.propTypes = {
  label: PropTypes.string,
  type: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  error: PropTypes.string,
  success: PropTypes.string,
  hint: PropTypes.string,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  placeholder: PropTypes.string,
  className: PropTypes.string,
  autoComplete: PropTypes.string,
  maxLength: PropTypes.number,
  pattern: PropTypes.string,
  onValidate: PropTypes.func,
  showCharCount: PropTypes.bool
};

AccessibleForm.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
  errors: PropTypes.object,
  isSubmitting: PropTypes.bool,
  className: PropTypes.string
};

FieldGroup.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  children: PropTypes.node.isRequired,
  className: PropTypes.string
};

AccessibleSwitch.propTypes = {
  checked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string.isRequired,
  description: PropTypes.string,
  disabled: PropTypes.bool,
  className: PropTypes.string
};

export default AccessibleForm;