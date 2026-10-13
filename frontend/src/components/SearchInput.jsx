import { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Search, X, Clock, TrendingUp } from 'lucide-react';

/**
 * Composant de recherche avec suggestions, historique et debouncing
 * Améliore l'UX avec recherche en temps réel et navigation clavier
 */
const SearchInput = ({
  placeholder = 'Rechercher...',
  onSearch,
  onSuggestionSelect,
  suggestions = [],
  isLoading = false,
  showHistory = true,
  showSuggestions = true,
  debounceMs = 300,
  maxSuggestions = 8,
  className = '',
  autoFocus = false,
  clearOnSelect = false
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searchHistory, setSearchHistory] = useState([]);
  
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  // Charger l'historique depuis localStorage
  useEffect(() => {
    if (showHistory) {
      const saved = localStorage.getItem('search-history');
      if (saved) {
        try {
          setSearchHistory(JSON.parse(saved));
        } catch (error) {
          console.warn('Failed to load search history:', error);
        }
      }
    }
  }, [showHistory]);

  // Sauvegarder l'historique
  const saveToHistory = useCallback((searchTerm) => {
    if (!showHistory || !searchTerm.trim()) return;
    
    const newHistory = [
      searchTerm,
      ...searchHistory.filter(item => item !== searchTerm)
    ].slice(0, 10); // Garder max 10 éléments
    
    setSearchHistory(newHistory);
    localStorage.setItem('search-history', JSON.stringify(newHistory));
  }, [searchHistory, showHistory]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      if (query.length > 0 && onSearch) {
        onSearch(query);
      }
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, onSearch, debounceMs]);

  // Fermer les suggestions en cliquant à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto focus si demandé
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    setSelectedIndex(-1);
    setIsOpen(value.length > 0 && (showSuggestions || showHistory));
  };

  const handleKeyDown = (e) => {
    if (!isOpen) return;

    const allItems = [
      ...(showHistory && query.length === 0 ? searchHistory.map(item => ({ type: 'history', value: item })) : []),
      ...(showSuggestions ? suggestions.slice(0, maxSuggestions).map(item => ({ type: 'suggestion', value: item })) : [])
    ];

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < allItems.length - 1 ? prev + 1 : 0
        );
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : allItems.length - 1
        );
        break;
      
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && allItems[selectedIndex]) {
          handleSelect(allItems[selectedIndex].value);
        } else if (query.trim()) {
          handleSearch();
        }
        break;
      
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSelect = (value) => {
    setQuery(clearOnSelect ? '' : value);
    setIsOpen(false);
    setSelectedIndex(-1);
    saveToHistory(value);
    
    if (onSuggestionSelect) {
      onSuggestionSelect(value);
    } else if (onSearch) {
      onSearch(value);
    }
  };

  const handleSearch = () => {
    if (!query.trim()) return;
    
    setIsOpen(false);
    setSelectedIndex(-1);
    saveToHistory(query.trim());
    
    if (onSearch) {
      onSearch(query.trim());
    }
  };

  const handleClear = () => {
    setQuery('');
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const handleFocus = () => {
    setIsOpen(query.length > 0 || (showHistory && searchHistory.length > 0));
  };

  // Préparer les éléments à afficher
  const historyItems = showHistory && query.length === 0 
    ? searchHistory.slice(0, 5).map(item => ({ type: 'history', value: item }))
    : [];
  
  const suggestionItems = showSuggestions && query.length > 0
    ? suggestions.slice(0, maxSuggestions).map(item => ({ type: 'suggestion', value: item }))
    : [];

  const allItems = [...historyItems, ...suggestionItems];
  const hasItems = allItems.length > 0;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input de recherche */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="
            block w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg
            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
            placeholder-gray-500 text-gray-900
            disabled:bg-gray-50 disabled:text-gray-500
          "
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
        />
        
        {/* Boutons à droite */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 space-x-1">
          {isLoading && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
          )}
          
          {query && !isLoading && (
            <button
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
              aria-label="Effacer la recherche"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Liste des suggestions */}
      {isOpen && (hasItems || isLoading) && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-auto">
          <ul ref={listRef} role="listbox" className="py-1">
            {/* Indicateur de chargement */}
            {isLoading && (
              <li className="px-4 py-3 text-center text-gray-500">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                Recherche en cours...
              </li>
            )}
            
            {/* Historique */}
            {historyItems.length > 0 && (
              <>
                <li className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  Recherches récentes
                </li>
                {historyItems.map((item, index) => (
                  <li
                    key={`history-${index}`}
                    onClick={() => handleSelect(item.value)}
                    className={`
                      px-4 py-3 cursor-pointer flex items-center space-x-3
                      ${selectedIndex === index ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700 hover:bg-gray-50'}
                    `}
                    role="option"
                    aria-selected={selectedIndex === index}
                  >
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="truncate">{item.value}</span>
                  </li>
                ))}
              </>
            )}
            
            {/* Suggestions */}
            {suggestionItems.length > 0 && (
              <>
                {historyItems.length > 0 && (
                  <li className="border-t border-gray-100"></li>
                )}
                <li className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Suggestions
                </li>
                {suggestionItems.map((item, index) => (
                  <li
                    key={`suggestion-${index}`}
                    onClick={() => handleSelect(item.value)}
                    className={`
                      px-4 py-3 cursor-pointer flex items-center space-x-3
                      ${selectedIndex === historyItems.length + index ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700 hover:bg-gray-50'}
                    `}
                    role="option"
                    aria-selected={selectedIndex === historyItems.length + index}
                  >
                    <TrendingUp className="h-4 w-4 text-gray-400" />
                    <span className="truncate">{item.value}</span>
                  </li>
                ))}
              </>
            )}
            
            {/* Aucun résultat */}
            {!isLoading && !hasItems && query.length > 0 && (
              <li className="px-4 py-3 text-center text-gray-500">
                Aucune suggestion trouvée
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

/**
 * Hook pour gérer la recherche avec debouncing
 */
export const useSearchDebounce = (callback, delay = 300) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (searchTerm.length > 0) {
      setIsSearching(true);
      debounceRef.current = setTimeout(async () => {
        try {
          await callback(searchTerm);
        } finally {
          setIsSearching(false);
        }
      }, delay);
    } else {
      setIsSearching(false);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchTerm, callback, delay]);

  return {
    searchTerm,
    setSearchTerm,
    isSearching
  };
};

SearchInput.propTypes = {
  placeholder: PropTypes.string,
  onSearch: PropTypes.func,
  onSuggestionSelect: PropTypes.func,
  suggestions: PropTypes.arrayOf(PropTypes.string),
  isLoading: PropTypes.bool,
  showHistory: PropTypes.bool,
  showSuggestions: PropTypes.bool,
  debounceMs: PropTypes.number,
  maxSuggestions: PropTypes.number,
  className: PropTypes.string,
  autoFocus: PropTypes.bool,
  clearOnSelect: PropTypes.bool
};

export default SearchInput;