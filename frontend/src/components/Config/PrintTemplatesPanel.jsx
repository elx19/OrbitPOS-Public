import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';
import Button from '../ui/Button';
import { Field, Select, TextArea } from '../ui/Field';
import Panel from '../ui/Panel';
import TicketPreview from '../ui/TicketPreview';

function TemplateCard({ title, description, children, className = '' }) {
  return (
    <div className={`rounded-[24px] border border-slate-200/80 bg-white/72 p-5 shadow-[0_14px_28px_-24px_rgba(23,32,51,0.45)] ${className}`.trim()}>
      <div className="text-sm font-bold text-ink">{title}</div>
      {description ? <div className="mt-1 text-xs leading-6 text-slate-500">{description}</div> : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default function PrintTemplatesPanel({ token, onActivity }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [message, setMessage] = useState('');
  const [meta, setMeta] = useState({
    documents: [],
    variants: [],
    placeholders: {},
    catalog: {},
    templates: {}
  });
  const [activeDocument, setActiveDocument] = useState('sale');
  const [drafts, setDrafts] = useState({});
  const [preview, setPreview] = useState('');

  useEffect(() => {
    let ignore = false;

    apiRequest('/api/config/print-templates', { token })
      .then((result) => {
        if (ignore) {
          return;
        }

        setMeta(result);
        setDrafts(result.templates || {});
        setActiveDocument((current) => current || result.documents?.[0]?.key || 'sale');
      })
      .catch((error) => {
        if (!ignore) {
          setMessage(error.message);
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [token]);

  const activeDraft = drafts[activeDocument] || { variant: 'classic', customTemplate: '' };
  const availableBaseTemplate = useMemo(() => (
    meta.catalog?.[activeDocument]?.[activeDraft.variant || 'classic'] || ''
  ), [meta.catalog, activeDocument, activeDraft.variant]);

  const activePlaceholders = useMemo(() => ([
    ...(meta.placeholders?.common || []),
    ...(meta.placeholders?.[activeDocument] || [])
  ]), [meta.placeholders, activeDocument]);

  useEffect(() => {
    if (!loading && activeDocument) {
      handlePreview(activeDocument, activeDraft.variant, activeDraft.customTemplate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, activeDocument]);

  function updateDraft(documentKey, changes) {
    setDrafts((current) => ({
      ...current,
      [documentKey]: {
        ...(current[documentKey] || { variant: 'classic', customTemplate: '' }),
        ...changes
      }
    }));
  }

  async function handlePreview(documentKey = activeDocument, variant = activeDraft.variant, customTemplate = activeDraft.customTemplate) {
    if (!documentKey) {
      return;
    }

    setPreviewing(true);
    setMessage('');

    try {
      const result = await apiRequest('/api/config/print-templates/preview', {
        method: 'POST',
        token,
        body: {
          documentKey,
          variant,
          customTemplate
        }
      });

      setPreview(result.preview || '');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setPreviewing(false);
    }
  }

  function loadBaseTemplateIntoEditor() {
    updateDraft(activeDocument, {
      customTemplate: availableBaseTemplate
    });
  }

  function clearCustomTemplate() {
    updateDraft(activeDocument, {
      customTemplate: ''
    });
  }

  async function saveTemplates() {
    setSaving(true);
    setMessage('');

    try {
      const result = await apiRequest('/api/config/print-templates', {
        method: 'PUT',
        token,
        body: {
          templates: drafts
        }
      });

      setMeta(result);
      setDrafts(result.templates || drafts);
      setMessage('Plantillas de impresion guardadas correctamente.');
      onActivity?.();
      await handlePreview();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Panel className="p-6 text-sm text-slate-600">
        Cargando plantillas de impresion...
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <Panel className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Impresion y tickets</div>
            <h3 className="mt-2 text-2xl font-bold text-ink">Plantillas editables</h3>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              Define el tipo de ticket por documento, edita la plantilla base y prueba la vista previa antes de imprimir.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" disabled={previewing} onClick={() => handlePreview()}>
              {previewing ? 'Generando vista...' : 'Vista previa'}
            </Button>
            <Button disabled={saving} onClick={saveTemplates}>
              {saving ? 'Guardando...' : 'Guardar plantillas'}
            </Button>
          </div>
        </div>

        {message ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {message}
          </div>
        ) : null}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[280px,minmax(0,1fr)]">
        <Panel className="p-4">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Tipos de documento</div>
          <div className="mt-4 space-y-2">
            {(meta.documents || []).map((document) => {
              const active = activeDocument === document.key;

              return (
                <button
                  key={document.key}
                  type="button"
                  onClick={() => setActiveDocument(document.key)}
                  className={active
                    ? 'w-full rounded-[22px] border border-transparent bg-ink px-4 py-3 text-left text-white shadow-soft'
                    : 'w-full rounded-[22px] border border-slate-200/80 bg-white/72 px-4 py-3 text-left text-slate-700 transition hover:bg-white'}
                >
                  <div className="text-sm font-semibold">{document.label}</div>
                  <div className={`mt-1 text-xs ${active ? 'text-white/72' : 'text-slate-500'}`}>
                    {document.description}
                  </div>
                </button>
              );
            })}
          </div>
        </Panel>

        <div className="space-y-6 min-w-0">
          <Panel className="p-5 md:p-6">
            <div className="grid gap-4 xl:grid-cols-[300px,minmax(0,1fr)]">
              <TemplateCard
                title="Tipo de ticket"
                description="Selecciona la plantilla base que quieres usar para este documento."
              >
                <Field label="Estilo base">
                  <Select
                    value={activeDraft.variant || 'classic'}
                    onChange={(event) => updateDraft(activeDocument, { variant: event.target.value })}
                  >
                    {(meta.variants || []).map((variant) => (
                      <option key={variant.value} value={variant.value}>
                        {variant.label}
                      </option>
                    ))}
                  </Select>
                </Field>

                <div className="mt-4 rounded-[20px] bg-white/80 p-4 text-sm text-slate-600">
                  {(meta.variants || []).find((variant) => variant.value === (activeDraft.variant || 'classic'))?.description || 'Plantilla base seleccionada.'}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={loadBaseTemplateIntoEditor}>
                    Cargar tipo base al editor
                  </Button>
                  <Button variant="ghost" onClick={clearCustomTemplate}>
                    Usar base sin editar
                  </Button>
                </div>
              </TemplateCard>

              <TemplateCard
                title="Editor de plantilla"
                description="Puedes editar libremente el ticket. Si el editor queda vacio, OrbitPOS usara el tipo base elegido."
              >
                <Field label="Plantilla editable" hint="Usa placeholders como {{invoiceNumber}}, [[items]] y {{totalLine}}">
                  <TextArea
                    rows={18}
                    value={activeDraft.customTemplate || ''}
                    onChange={(event) => updateDraft(activeDocument, { customTemplate: event.target.value })}
                  />
                </Field>
              </TemplateCard>
            </div>
          </Panel>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),320px]">
            <TicketPreview
              title="Vista previa del ticket"
              content={preview}
              actions={(
                <Button variant="secondary" disabled={previewing} onClick={() => handlePreview()}>
                  {previewing ? 'Actualizando...' : 'Actualizar vista'}
                </Button>
              )}
            />

            <Panel className="p-5 md:p-6">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Placeholders disponibles</div>
              <div className="mt-4 space-y-3">
                {activePlaceholders.map((placeholder) => (
                  <div
                    key={`${activeDocument}-${placeholder.token}`}
                    className="rounded-[20px] border border-slate-200/80 bg-white/72 px-4 py-3"
                  >
                    <div className="font-mono text-xs font-semibold text-ink">{placeholder.token}</div>
                    <div className="mt-1 text-xs leading-6 text-slate-500">{placeholder.label}</div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
