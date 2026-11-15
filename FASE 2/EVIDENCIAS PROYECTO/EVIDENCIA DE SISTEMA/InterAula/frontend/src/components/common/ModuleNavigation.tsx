import '../../styles/guidedExperience.css';

type Item<T extends string> = { id: T; label: string };
type Props<T extends string> = {
  label: string; active: T; onSelect: (id: T) => void;
  primary: Item<T>[]; secondary?: Item<T>[];
};

/** Every destination remains visible; secondary styling provides hierarchy. */
export default function ModuleNavigation<T extends string>({ label, active, onSelect, primary, secondary = [] }: Props<T>) {
  const renderItem = (item: Item<T>) => <button key={item.id} type="button" className={'ia-module-choice ' + (active === item.id ? 'active' : '')} aria-current={active === item.id ? 'page' : undefined} onClick={() => onSelect(item.id)}>{item.label}</button>;
  return <nav className="ia-module-nav" aria-label={label}>
    <div className="ia-module-primary">{primary.map(renderItem)}</div>
    {secondary.length > 0 && <div className="ia-module-secondary">{secondary.map(renderItem)}</div>}
  </nav>;
}
