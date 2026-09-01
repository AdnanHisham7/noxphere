// src/features/academies/PlatformBillingCard.tsx
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { CircleDollarSign, Users2 } from "lucide-react";
import { Button, Input } from "../../components/ui";
import {
  useGetPlatformDefaultRateQuery,
  useSetPlatformDefaultRateMutation,
  useGetPlatformDefaultStaffRateQuery,
  useSetPlatformDefaultStaffRateMutation,
} from "../../store/api/academySubscriptionApi";

export const PlatformBillingCard: React.FC = () => {
  const { data: currentRate, isLoading } = useGetPlatformDefaultRateQuery();
  const [setRate, { isLoading: saving }] = useSetPlatformDefaultRateMutation();
  const [value, setValue] = useState("");

  const { data: currentStaffRate, isLoading: staffLoading } = useGetPlatformDefaultStaffRateQuery();
  const [setStaffRate, { isLoading: savingStaff }] = useSetPlatformDefaultStaffRateMutation();
  const [staffValue, setStaffValue] = useState("");

  useEffect(() => {
    if (currentRate !== undefined) setValue(String(currentRate));
  }, [currentRate]);

  useEffect(() => {
    if (currentStaffRate !== undefined) setStaffValue(String(currentStaffRate));
  }, [currentStaffRate]);

  const handleSave = async () => {
    const parsed = parseFloat(value);
    if (Number.isNaN(parsed) || parsed < 0) {
      toast.error("Enter a valid rate");
      return;
    }
    try {
      await setRate(parsed).unwrap();
      toast.success("Platform default rate updated");
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't update rate — try again");
    }
  };

  const handleSaveStaff = async () => {
    const parsed = parseFloat(staffValue);
    if (Number.isNaN(parsed) || parsed < 0) {
      toast.error("Enter a valid rate");
      return;
    }
    try {
      await setStaffRate(parsed).unwrap();
      toast.success("Platform default staff rate updated");
    } catch (err: any) {
      toast.error(err?.data?.message || "Couldn't update rate — try again");
    }
  };

  return (
    <div className="card p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="w-9 h-9 rounded-full bg-volt-400/10 border border-volt-400/20 flex items-center justify-center flex-shrink-0">
            <CircleDollarSign size={16} className="text-volt-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white">Platform Default Rate — Students</p>
            <p className="text-2xs text-slate-500">
              Applied to every academy's subscription unless they have a rate override
            </p>
          </div>
        </div>
        <div className="flex items-end gap-2">
          <Input
            label="₹/student/day"
            type="number"
            step="0.01"
            value={isLoading ? "" : value}
            onChange={(e) => setValue(e.target.value)}
            className="w-32"
          />
          <Button size="sm" loading={saving} onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4 pt-4 border-t border-white/5">
        <div className="flex items-center gap-2 flex-1">
          <div className="w-9 h-9 rounded-full bg-ice-400/10 border border-ice-400/20 flex items-center justify-center flex-shrink-0">
            <Users2 size={16} className="text-ice-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white">Platform Default Rate — Staff Seats</p>
            <p className="text-2xs text-slate-500">
              Billed for every software-managing employee an academy adds
            </p>
          </div>
        </div>
        <div className="flex items-end gap-2">
          <Input
            label="₹/staff/month"
            type="number"
            step="0.01"
            value={staffLoading ? "" : staffValue}
            onChange={(e) => setStaffValue(e.target.value)}
            className="w-32"
          />
          <Button size="sm" loading={savingStaff} onClick={handleSaveStaff}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
};