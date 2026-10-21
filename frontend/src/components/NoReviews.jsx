/*
 * Affiché à la place de la note quand un produit n'a pas encore d'avis :
 * 5 étoiles grises vides + « Aucun avis » (au lieu d'un « 0 » sans étoiles).
 */
export default function NoReviews({ className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm text-gray-400 ${className}`}>
      <span className="tracking-tight text-gray-300" aria-hidden="true">★★★★★</span>
      Aucun avis
    </span>
  );
}
