// src/features/expenses/components/AddStockItemModal.tsx
import React, { useState } from "react";
import { Modal, Button, Input, Select } from "../../../components/ui";
import { useCreateStockMutation } from "../../../store/api/expenseApi";
import toast from "react-hot-toast";

interface AddStockItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  academyId: string;
  franchiseId?: string;
}

const STOCK_CATEGORIES = [
  "Equipment",
  "Apparel & Uniforms",
  "Footwear",
  "Training Gear",
  "Balls & Inflatables",
  "Medical & Physio",
  "Ground & Field Supplies",
  "Merchandise",
  "Other",
];

export const AddStockItemModal: React.FC<AddStockItemModalProps> = ({
  isOpen,
  onClose,
  academyId,
  franchiseId,
}) => {
  const [createStock, { isLoading }] = useCreateStockMutation();

  const [name, setName] = useState<string>("");
  const [sku, setSku] = useState<string>("");
  const [category, setCategory] = useState<string>("Equipment");
  const [unit, setUnit] = useState<string>("units");
  const [initialQuantity, setInitialQuantity] = useState<number>(0);
  const [minQuantityAlert, setMinQuantityAlert] = useState<number>(5);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [location, setLocation] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter item name");
      return;
    }

    try {
      await createStock({
        academyId,
        franchiseId: franchiseId && franchiseId !== "all" ? franchiseId : undefined,
        name: name.trim(),
        sku: sku.trim() || undefined,
        category,
        unit: unit.trim() || "units",
        initialQuantity: Number(initialQuantity) || 0,
        minQuantityAlert: Number(minQuantityAlert) || 5,
        unitPrice: Number(unitPrice) || 0,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
      }).unwrap();

      toast.success("Stock item created successfully!");
      setName("");
      setSku("");
      setInitialQuantity(0);
      setLocation("");
      setNotes("");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to create stock item");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Stock Item" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Item Name *
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Training Bibs (Fluorescent Yellow)"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Select
              label="Category *"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            >
              {STOCK_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              SKU / Code (Optional)
            </label>
            <Input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="e.g. BIB-YLW-01"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Initial Quantity
            </label>
            <Input
              type="number"
              min="0"
              value={initialQuantity}
              onChange={(e) => setInitialQuantity(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Unit (e.g. pcs, sets)
            </label>
            <Input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="pcs"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Low Stock Alert Limit
            </label>
            <Input
              type="number"
              min="0"
              value={minQuantityAlert}
              onChange={(e) => setMinQuantityAlert(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Estimated Unit Cost (₹)
            </label>
            <Input
              type="number"
              min="0"
              step="any"
              value={unitPrice}
              onChange={(e) => setUnitPrice(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Storage Location
            </label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Equipment Room Shelf 2"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="input w-full text-sm resize-none"
            placeholder="Size, brand, or maintenance details..."
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/5">
          <Button variant="ghost" type="button" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={isLoading}>
            Create Stock Item
          </Button>
        </div>
      </form>
    </Modal>
  );
};
