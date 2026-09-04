import { useDeferredValue, useMemo, useRef, useState } from "react";

import { Outlook } from "./components/Outlook";
import { PlannerInputs } from "./components/PlannerInputs";
import {
  DEFAULT_CLIENT_ID,
  getScenario,
} from "./data/clients";
import { buildForecast } from "./model/forecast";
import { validateScenario } from "./model/statistics";
import type { PageInput, ProgramInputs } from "./model/types";

export default function App() {
  const [selectedPresetId, setSelectedPresetId] = useState(DEFAULT_CLIENT_ID);
  const [scenario, setScenario] = useState(() => getScenario(DEFAULT_CLIENT_ID));
  const [dirty, setDirty] = useState(false);
  const newPageNumber = useRef(1);
  const deferredScenario = useDeferredValue(scenario);
  const currentIssues = useMemo(() => validateScenario(scenario), [scenario]);
  const forecast = useMemo(
    () => buildForecast(deferredScenario),
    [deferredScenario],
  );
  const updating = deferredScenario !== scenario;

  const selectPreset = (id: string): void => {
    setSelectedPresetId(id);
    setScenario(getScenario(id));
    setDirty(false);
  };

  const resetPreset = (): void => {
    setScenario(getScenario(selectedPresetId));
    setDirty(false);
  };

  const updateScenario = (
    recipe: (current: typeof scenario) => typeof scenario,
  ): void => {
    setScenario(recipe);
    setDirty(true);
  };

  const updateProgram = <K extends keyof ProgramInputs>(
    field: K,
    value: ProgramInputs[K],
  ): void => {
    updateScenario((current) => ({
      ...current,
      program: { ...current.program, [field]: value },
    }));
  };

  const updatePage = <K extends keyof PageInput>(
    pageId: string,
    field: K,
    value: PageInput[K],
  ): void => {
    updateScenario((current) => ({
      ...current,
      pages: current.pages.map((page) =>
        page.id === pageId ? { ...page, [field]: value } : page,
      ),
    }));
  };

  const addPage = (): void => {
    const number = newPageNumber.current;
    newPageNumber.current += 1;
    updateScenario((current) => ({
      ...current,
      pages: [
        ...current.pages,
        {
          id: `custom-page-${number}`,
          name: `New page ${number}`,
          conversion_name: "conversion",
          daily_visitors: 1000,
          baseline_rate: 0.05,
          revenue_per_conversion: 0,
          min_detectable_lift: 0.05,
          expected_winner_lift: 0.05,
          value_model: { kind: "none" },
        },
      ],
    }));
  };

  const removePage = (pageId: string): void => {
    updateScenario((current) => ({
      ...current,
      pages: current.pages.filter((page) => page.id !== pageId),
    }));
  };

  return (
    <main className="app-shell">
      <PlannerInputs
        scenario={scenario}
        selectedPresetId={selectedPresetId}
        dirty={dirty}
        issues={currentIssues}
        onSelectPreset={selectPreset}
        onReset={resetPreset}
        onCompanyChange={(company) =>
          updateScenario((current) => ({ ...current, company }))
        }
        onProgramChange={updateProgram}
        onPageChange={updatePage}
        onAddPage={addPage}
        onRemovePage={removePage}
      />
      <Outlook
        scenario={deferredScenario}
        forecast={forecast}
        updating={updating}
        onPrint={() => window.print()}
      />
    </main>
  );
}
