// src/features/settings/AcademySettingsPage.tsx
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Settings, Plus, X, Save, Building2 } from "lucide-react";
import { Button, Input, Card, Badge, Skeleton, EmptyState } from "../../components/ui";
import { useCurrentAcademyId } from "../../hooks/useCurrentAcademyId";
import { academyApi } from "../../store/api/academyApi";
import type { Location } from "../academies/types";

const useGetAcademyById = academyApi.useGetAcademyByIdQuery;
const useUpdateAcademyConfig = academyApi.useUpdateAcademyConfigMutation;

const AcademySettingsPage: React.FC = () => {
  const academyId = useCurrentAcademyId();
  const { data: academy, isLoading, isError } = useGetAcademyById(academyId ?? "", { skip: !academyId });
  const [updateConfig, { isLoading: saving }] = useUpdateAcademyConfig();

  const [name, setName] = useState("");
  const [location, setLocation] = useState<Location>({ name: "", address: "", latitude: 0, longitude: 0, fieldNumber: "" });
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [absentAlertDays, setAbsentAlertDays] = useState(5);
  const [dueDateAlertDays, setDueDateAlertDays] = useState(3);

  useEffect(() => {
    if (!academy) return;
    setName(academy.name);
    setLocation(academy.location);
    setCategories(academy.ageGroups);
    setAbsentAlertDays(academy.absentAlertDays);
    setDueDateAlertDays(academy.dueDateAlertDays);
  }, [academy]);

  const addCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    if (categories?.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("That category already exists");
      return;
    }
    setCategories((prev) => [...prev, trimmed]);
    setNewCategory("");
  };

  const removeCategory = (category: string) => {
    setCategories((prev) => prev.filter((c) => c !== category));
  };

  const handleSave = async () => {
    if (!academyId) return;
    if (!name.trim()) {
      toast.error("Academy name can't be empty");
      return;
    }
    if (absentAlertDays < 1) {
      toast.error("Absence alert threshold must be at least 1 day");
      return;
    }
    if (dueDateAlertDays < 0) {
      toast.error("Due-date alert threshold can't be negative");
      return;
    }
    try {
      await updateConfig({
        id: academyId,
        config: {
          name: name.trim(),
          location,
          ageGroups: categories,
          absentAlertDays,
          dueDateAlertDays,
        },
      }).unwrap();
      toast.success("Settings saved");
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't save settings — try again");
    }
  };

  if (!academyId) {
    return (
      <EmptyState
        icon={<Settings size={28} />}
        title="No franchise selected"
        description="Select a franchise from the top bar to manage academy settings."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !academy) {
    return (
      <EmptyState
        icon={<Settings size={28} />}
        title="Couldn't load settings"
        description="Something went wrong loading your academy settings. Try refreshing."
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-white uppercase tracking-wide">Academy settings</h1>
          <p className="text-xs text-slate-400 mt-1">
            These apply academy-wide, across every franchise of {academy.name}.
          </p>
        </div>
        <Button icon={<Save size={15} />} loading={saving} onClick={handleSave}>
          Save changes
        </Button>
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Building2 size={16} className="text-volt-400" />
          <h2 className="font-display text-sm font-bold text-white uppercase tracking-wide">Academy details</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Academy name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input
            label="Location name"
            value={location?.name}
            onChange={(e) => setLocation((prev) => ({ ...prev, name: e.target.value }))}
          />
          <Input
            label="Address"
            className="sm:col-span-2"
            value={location?.address}
            onChange={(e) => setLocation((prev) => ({ ...prev, address: e.target.value }))}
          />
          <Input
            label="Latitude"
            type="number"
            step="any"
            value={location?.latitude}
            onChange={(e) => setLocation((prev) => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))}
          />
          <Input
            label="Longitude"
            type="number"
            step="any"
            value={location?.longitude}
            onChange={(e) => setLocation((prev) => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))}
          />
          <Input
            label="Field number (optional)"
            value={location?.fieldNumber ?? ""}
            onChange={(e) => setLocation((prev) => ({ ...prev, fieldNumber: e.target.value }))}
          />
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-sm font-bold text-white uppercase tracking-wide mb-1">Age categories</h2>
        <p className="text-xs text-slate-400 mb-4">
          Used across every franchise when creating teams and sessions — e.g. U-14, U-15, U-16.
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          {categories?.length === 0 && <p className="text-xs text-slate-500">No categories yet — add one below.</p>}
          {categories?.map((category) => (
            <Badge key={category} variant="blue" className="flex items-center gap-1.5 pr-1.5">
              {category}
              <button
                type="button"
                onClick={() => removeCategory(category)}
                className="hover:text-ember-400 transition-colors"
                aria-label={`Remove ${category}`}
              >
                <X size={12} />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2 max-w-sm">
          <Input
            placeholder="e.g. U-17"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCategory();
              }
            }}
          />
          <Button type="button" variant="secondary" icon={<Plus size={15} />} onClick={addCategory}>
            Add
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-sm font-bold text-white uppercase tracking-wide mb-1">Guardian alert thresholds</h2>
        <p className="text-xs text-slate-400 mb-4">
          Controls when the automated absence and installment-due WhatsApp/system alerts fire.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Consecutive absent days before alert"
            type="number"
            min={1}
            max={30}
            value={absentAlertDays}
            onChange={(e) => setAbsentAlertDays(parseInt(e.target.value, 10) || 1)}
          />
          <Input
            label="Days before installment due date to alert"
            type="number"
            min={0}
            max={30}
            value={dueDateAlertDays}
            onChange={(e) => setDueDateAlertDays(parseInt(e.target.value, 10) || 0)}
          />
        </div>
      </Card>
    </div>
  );
};

export default AcademySettingsPage;
