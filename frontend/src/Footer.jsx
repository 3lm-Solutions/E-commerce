import { Link } from "react-router-dom";

function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-2 md:grid-cols-4 gap-10">
        <div>
          <h3 className="text-xl font-extrabold tracking-tight text-white">
            3lm<span className="text-indigo-600">solutions</span>
          </h3>
          <p className="mt-3 text-sm leading-relaxed">
            La plateforme e-commerce pilotée par l'intelligence artificielle.
          </p>
        </div>

        <div>
          <h6 className="text-white font-semibold mb-3">Navigation</h6>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/" className="hover:text-indigo-500 transition-colors">
                Accueil
              </Link>
            </li>
            <li>
              <Link to="/products" className="hover:text-indigo-500 transition-colors">
                Produits
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h6 className="text-white font-semibold mb-3">Aide</h6>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/aide#livraison" className="hover:text-indigo-500 transition-colors">
                Livraison
              </Link>
            </li>
            <li>
              <Link to="/aide#retours" className="hover:text-indigo-500 transition-colors">
                Retours
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-gray-800 py-5 text-center text-xs text-gray-600">
        © 2026 3lmsolutions — Tous droits réservés
      </div>
    </footer>
  );
}

export default Footer;