"use client";

import { useState, useRef } from "react";
import { ingestPDF, query, evaluate } from "@/lib/api";

type SourceDoc = { content: string; source: string };
type QueryResult = { question: string; answer: string; source_documents: SourceDoc[] };
type EvalSample = { question: string; answer: string; contexts: string; ground_truth: string };
type EvalResult = {
  user_input: string;
  question?: string;
  faithfulness: number | null;
  answer_relevancy: number | null;
  context_precision: number | null;
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestResult, setIngestResult] = useState<{ filename: string; chunks_indexed: number } | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [question, setQuestion] = useState("");
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  const [evalSamples, setEvalSamples] = useState<EvalSample[]>([
    { question: "", answer: "", contexts: "", ground_truth: "" },
  ]);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalResults, setEvalResults] = useState<EvalResult[] | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);

  async function handleIngest() {
    if (!file) return;
    setIngestLoading(true);
    setIngestError(null);
    setIngestResult(null);
    try {
      const res = await ingestPDF(file);
      setIngestResult(res);
    } catch (e: unknown) {
      setIngestError(e instanceof Error ? e.message : String(e));
    } finally {
      setIngestLoading(false);
    }
  }

  async function handleQuery(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setQueryLoading(true);
    setQueryError(null);
    setQueryResult(null);
    try {
      const res = await query(question);
      setQueryResult(res);
    } catch (e: unknown) {
      setQueryError(e instanceof Error ? e.message : String(e));
    } finally {
      setQueryLoading(false);
    }
  }

  function addQueryAsEvalSample() {
    if (!queryResult) return;
    const contexts = queryResult.source_documents.map((d) => d.content).join("\n");
    const newSample: EvalSample = {
      question: queryResult.question,
      answer: queryResult.answer,
      contexts,
      ground_truth: "",
    };
    setEvalSamples((prev) => {
      const emptyIdx = prev.findIndex((s) => !s.question && !s.answer && !s.contexts);
      if (emptyIdx !== -1) {
        return prev.map((s, i) => (i === emptyIdx ? newSample : s));
      }
      return [...prev, newSample];
    });
    document.getElementById("eval-section")?.scrollIntoView({ behavior: "smooth" });
  }

  async function handleEvaluate(e: React.SyntheticEvent) {
    e.preventDefault();
    setEvalLoading(true);
    setEvalError(null);
    setEvalResults(null);
    try {
      const samples = evalSamples.map((s) => ({
        question: s.question,
        answer: s.answer,
        contexts: s.contexts
          .split("\n")
          .map((c) => c.trim())
          .filter(Boolean),
        ground_truth: s.ground_truth,
      }));
      const res = await evaluate(samples);
      setEvalResults(res.results);
    } catch (e: unknown) {
      setEvalError(e instanceof Error ? e.message : String(e));
    } finally {
      setEvalLoading(false);
    }
  }

  function updateSample(i: number, field: keyof EvalSample, value: string) {
    setEvalSamples((prev) => prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));
  }

  function fmt(v: number | null) {
    return v == null ? "—" : v.toFixed(3);
  }

  function scoreColor(v: number | null) {
    if (v == null) return "text-gray-400";
    if (v >= 0.7) return "text-green-600";
    if (v >= 0.4) return "text-yellow-600";
    return "text-red-500";
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">RAG Eval</h1>
          <p className="text-gray-500 mt-1">Evaluación de pipelines RAG</p>
        </div>

        {/* Ingest */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-800">1. Ingestar PDF</h2>
          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const dropped = e.dataTransfer.files[0];
              if (dropped?.name.endsWith(".pdf")) setFile(dropped);
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <p className="text-blue-600 font-medium">{file.name}</p>
            ) : (
              <p className="text-gray-400">Arrastrá un PDF o hacé clic para seleccionar</p>
            )}
          </div>
          <button
            onClick={handleIngest}
            disabled={!file || ingestLoading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {ingestLoading ? "Ingresando…" : "Ingestar"}
          </button>
          {ingestResult && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
              <strong>{ingestResult.filename}</strong> indexado con{" "}
              <strong>{ingestResult.chunks_indexed} chunks</strong>.
            </div>
          )}
          {ingestError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">{ingestError}</div>
          )}
        </section>

        {/* Query */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-800">2. Consultar</h2>
          <form onSubmit={handleQuery} className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Hacé una pregunta sobre el PDF…"
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              type="submit"
              disabled={!question.trim() || queryLoading}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {queryLoading ? "…" : "Consultar"}
            </button>
          </form>
          {queryResult && (
            <div className="space-y-3">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Respuesta</p>
                <p className="text-gray-800 text-sm whitespace-pre-wrap">{queryResult.answer}</p>
              </div>
              {queryResult.source_documents?.length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                    Fuentes ({queryResult.source_documents.length})
                  </summary>
                  <div className="mt-2 space-y-2">
                    {queryResult.source_documents.map((doc, i) => (
                      <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <p className="text-xs text-gray-400 mb-1">{doc.source}</p>
                        <p className="text-gray-700 text-xs">{doc.content}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}
              <button
                onClick={addQueryAsEvalSample}
                className="text-sm text-blue-600 hover:underline"
              >
                + Agregar como muestra de evaluación
              </button>
            </div>
          )}
          {queryError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">{queryError}</div>
          )}
        </section>

        {/* Evaluate */}
        <section id="eval-section" className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">3. Evaluar</h2>
            <p className="text-xs text-gray-400 mt-1">
              Completá las muestras (podés agregarlas desde &quot;Consultar&quot;) y escribí la respuesta esperada en{" "}
              <em>ground truth</em>. La evaluación puede tardar 1-2 minutos.
            </p>
          </div>
          <form onSubmit={handleEvaluate} className="space-y-4">
            {evalSamples.map((s, i) => (
              <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Muestra {i + 1}</p>
                  {evalSamples.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setEvalSamples((p) => p.filter((_, idx) => idx !== i))}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Question</label>
                  <input
                    type="text"
                    value={s.question}
                    onChange={(e) => updateSample(i, "question", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Answer</label>
                  <textarea
                    value={s.answer}
                    onChange={(e) => updateSample(i, "answer", e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Ground truth{" "}
                    <span className="text-gray-400 font-normal">(respuesta correcta esperada)</span>
                  </label>
                  <input
                    type="text"
                    value={s.ground_truth}
                    onChange={(e) => updateSample(i, "ground_truth", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Contextos <span className="text-gray-400 font-normal">(auto-completados desde Fuentes)</span>
                  </label>
                  <textarea
                    value={s.contexts}
                    onChange={(e) => updateSample(i, "contexts", e.target.value)}
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white resize-none font-mono text-xs"
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setEvalSamples((p) => [...p, { question: "", answer: "", contexts: "", ground_truth: "" }])
              }
              className="text-sm text-blue-600 hover:underline"
            >
              + Agregar muestra vacía
            </button>
            <button
              type="submit"
              disabled={evalLoading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {evalLoading ? "Evaluando… (puede tardar 1-2 min)" : "Evaluar"}
            </button>
          </form>
          {evalResults && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase border-b border-gray-200">
                    <th className="text-left py-2 pr-4">Pregunta</th>
                    <th className="text-right py-2 px-4">Faithfulness</th>
                    <th className="text-right py-2 px-4">Answer Relevancy</th>
                    <th className="text-right py-2 pl-4">Context Precision</th>
                  </tr>
                </thead>
                <tbody>
                  {evalResults.map((r, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 pr-4 text-gray-700 max-w-xs truncate">{r.user_input ?? r.question}</td>
                      <td className={`py-2 px-4 text-right font-mono ${scoreColor(r.faithfulness)}`}>
                        {fmt(r.faithfulness)}
                      </td>
                      <td className={`py-2 px-4 text-right font-mono ${scoreColor(r.answer_relevancy)}`}>
                        {fmt(r.answer_relevancy)}
                      </td>
                      <td className={`py-2 pl-4 text-right font-mono ${scoreColor(r.context_precision)}`}>
                        {fmt(r.context_precision)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {evalError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">{evalError}</div>
          )}
        </section>
      </div>
    </main>
  );
}
