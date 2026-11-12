import { Icon } from "../lib/icon";
import { useCopy } from "../lib/language";
import type { Locating } from "../lib/use-location";

const COPY = {
  en: {
    asking: "finding you…",
    denied:
      "Location is off for this site. Allow it in the browser to use this.",
    label: "near me",
    unavailable: "Your location could not be found just now.",
  },
  fr: {
    asking: "localisation…",
    denied:
      "La localisation est coupée pour ce site. Autorisez-la dans le navigateur pour l’utiliser.",
    label: "près de moi",
    unavailable: "Votre position n’a pas pu être trouvée pour le moment.",
  },
};

/** Asks for the rider's position when pressed, and says why when it cannot. */
export const LocateButton = ({
  locating,
  onPress,
}: {
  locating: Locating;
  onPress: () => void;
}) => {
  const t = useCopy(COPY);

  const problems: Partial<Record<Locating["state"], string>> = {
    denied: t.denied,
    unavailable: t.unavailable,
  };

  const problem = problems[locating.state] ?? "";

  return (
    <div className="locate">
      <button
        type="button"
        className="btn btn--pill"
        aria-pressed={locating.state === "found"}
        disabled={locating.state === "asking"}
        onClick={onPress}
      >
        <Icon name="pin" size={16} />
        {locating.state === "asking" ? t.asking : t.label}
      </button>
      {problem ? (
        <p className="hint" role="status">
          {problem}
        </p>
      ) : null}
    </div>
  );
};
