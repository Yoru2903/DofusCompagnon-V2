import { useMutation } from '@tanstack/react-query';
import { ItemAutocomplete } from '../components/ItemAutocomplete.js';
import { createPriceSnapshot } from '../features/prices/services/priceService.js';

export function PricesPage() {
  const createMutation = useMutation({ mutationFn: createPriceSnapshot });

  return (
    <section className="workspace-page">
      <header className="page-header">
        <p className="eyebrow">Prix</p>
        <h1>Saisie rapide des prix</h1>
      </header>

      <section className="panel narrow-panel">
        <form
          className="stacked-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            createMutation.mutate({
              itemId: String(form.get('itemId') ?? ''),
              unitPrice: Number(form.get('unitPrice') ?? 0),
              lotSize: Number(form.get('lotSize') ?? 1),
              priceType: String(form.get('priceType') ?? 'resource') as never,
              scope: String(form.get('scope') ?? 'group') as never,
            });
            event.currentTarget.reset();
          }}
        >
          <ItemAutocomplete name="itemId" label="Item" required />
          <select name="priceType" defaultValue="resource">
            <option value="resource">Ressource</option>
            <option value="rune">Rune</option>
            <option value="item">Equipement</option>
            <option value="resale">Revente</option>
          </select>
          <select name="scope" defaultValue="group">
            <option value="group">Groupe</option>
            <option value="personal">Personnel</option>
            <option value="global">Global</option>
          </select>
          <input name="unitPrice" type="number" min="0" placeholder="Prix unitaire" required />
          <input name="lotSize" type="number" min="1" defaultValue="1" />
          <button type="submit">Enregistrer le prix</button>
        </form>
        {createMutation.isSuccess && <p className="gain">Prix enregistre.</p>}
      </section>
    </section>
  );
}
