// src/features/students/StudentsPage.tsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { clsx } from "clsx";
import { Eye, EyeOff, Shuffle } from "lucide-react";
import {
  Button,
  Input,
  Badge,
  Avatar,
  EmptyState,
  Modal,
} from "../../components/ui";
import { toast } from "react-hot-toast";
import player1 from "../../assets/players/player1.png";
import player2 from "../../assets/players/player2.png";
import player3 from "../../assets/players/player3.png";
import player4 from "../../assets/players/player4.png";
import player5 from "../../assets/players/player5.png";
import player6 from "../../assets/players/player6.png";
import { PlayerPlaceholder } from "@/components/ui/PlayerPlaceholder";
import mannequinPng from "../../assets/players/mannequin.png";
import { ROLE_ROUTES } from "@/constants/roleRoutes";
import { RootState } from "@/store";
import { useSelector } from "react-redux";

interface PlayerCardContentProps {
  student: Student;
  getRatingColor: (r: number) => string;
  selectionBadge: typeof selectionBadge;
}

const PlayerCardContent: React.FC<PlayerCardContentProps> = ({
  student,
  getRatingColor,
  selectionBadge,
}) => {
  return (
    <>
      {/* Main dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/10 z-10" />

      {/* Top UI - Smaller */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex items-start justify-between">
        <div>
          <p className="text-[9px] uppercase tracking-[0.5px] text-white/50 font-semibold">
            {student.position}
          </p>
          <h3 className="font-display font-black uppercase leading-none text-white text-base mt-1">
            {student.firstName}
            <br />
            {student.lastName}
          </h3>
        </div>

        <div className="text-right">
          <p className="text-[9px] text-white/40 uppercase tracking-wider">
            Rating
          </p>
          <div
            className={clsx(
              "font-display text-3xl font-black leading-none",
              getRatingColor(student.overallRating),
            )}
          >
            {student.overallRating.toFixed(1)}
          </div>
        </div>
      </div>

      {/* Jersey Number - Smaller */}
      <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none">
        <span className="font-display font-black text-[110px] leading-none text-white/[0.06] select-none">
          {student.jerseyNumber}
        </span>
      </div>

      {/* Bottom Info - Compact */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-2.5">
        <div className="mb-2">
          <div className="flex items-center justify-between text-[9px] mb-1">
            <span className="text-white/45 uppercase tracking-wider">
              Attendance
            </span>
            <span
              className={
                student.attendancePercentage >= 90
                  ? "text-field-400"
                  : student.attendancePercentage >= 75
                    ? "text-volt-400"
                    : "text-ember-400"
              }
            >
              {student.attendancePercentage}%
            </span>
          </div>
          <div className="h-1 rounded-full bg-white/10 overflow-hidden">
            <div
              className={clsx(
                "h-full rounded-full",
                student.attendancePercentage >= 90
                  ? "bg-field-400"
                  : student.attendancePercentage >= 75
                    ? "bg-volt-400"
                    : "bg-ember-400",
              )}
              style={{ width: `${student.attendancePercentage}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Badge
            variant={selectionBadge[student.selectionStatus].variant}
            // size="sm"
          >
            {selectionBadge[student.selectionStatus].label}
          </Badge>

          <div className="text-right">
            <p className="text-[9px] text-white/40 uppercase">Team</p>
            <p className="text-xs text-white font-medium">{student.team}</p>
          </div>
        </div>
      </div>

      {student.transferStatus === "listed" && (
        <div className="absolute top-2.5 right-2.5 z-30">
          <span className="pill-blue text-2xs">↔ LISTED</span>
        </div>
      )}
    </>
  );
};

type SelectionStatus =
  | "pending"
  | "shortlisted"
  | "selected"
  | "not_selected"
  | "on_hold"
  | "released";
type TransferStatus = "not_listed" | "listed" | "sold";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  ageGroup: string;
  team: string;
  coach: string;
  jerseyNumber: number;
  photo?: string;
  attendancePercentage: number;
  overallRating: number;
  selectionStatus: SelectionStatus;
  transferStatus: TransferStatus;
  isActive: boolean;
}

const mockStudents: Student[] = [
  {
    id: "1",
    firstName: "Lionel",
    lastName: "Messi",
    position: "Forward",
    ageGroup: "U-17",
    team: "Team A",
    coach: "Ali Hassan",
    jerseyNumber: 9,
    attendancePercentage: 96,
    overallRating: 9.2,
    selectionStatus: "selected",
    transferStatus: "not_listed",
    photo: player1,
    isActive: true,
  },
  {
    id: "2",
    firstName: "Neymer",
    lastName: "Jr",
    position: "Midfielder",
    ageGroup: "U-15",
    team: "Team B",
    coach: "Raj Kumar",
    jerseyNumber: 8,
    attendancePercentage: 92,
    overallRating: 8.8,
    selectionStatus: "shortlisted",
    transferStatus: "listed",
    photo: player2,
    isActive: true,
  },
  {
    id: "3",
    firstName: "Gabriel",
    lastName: "Batistuta",
    position: "Goalkeeper",
    ageGroup: "U-19",
    team: "Team A",
    coach: "Ali Hassan",
    jerseyNumber: 1,
    attendancePercentage: 98,
    overallRating: 8.5,
    selectionStatus: "pending",
    transferStatus: "not_listed",
    photo: player3,
    isActive: true,
  },
  {
    id: "4",
    firstName: "Cristiano",
    lastName: "Ronaldo",
    position: "Defender",
    ageGroup: "U-17",
    team: "Team C",
    coach: "Priya Nair",
    jerseyNumber: 5,
    attendancePercentage: 84,
    overallRating: 7.2,
    selectionStatus: "on_hold",
    transferStatus: "not_listed",
    photo: player4,
    isActive: true,
  },
  {
    id: "5",
    firstName: "Lamine",
    lastName: "Yamal",
    position: "Forward",
    ageGroup: "U-15",
    team: "Team B",
    coach: "Raj Kumar",
    jerseyNumber: 11,
    attendancePercentage: 78,
    overallRating: 6.8,
    selectionStatus: "not_selected",
    transferStatus: "not_listed",
    photo: "",
    isActive: true,
  },
  {
    id: "6",
    firstName: "Ronaldinho",
    lastName: "",
    position: "Midfielder",
    ageGroup: "U-19",
    team: "Team C",
    coach: "Priya Nair",
    jerseyNumber: 6,
    attendancePercentage: 90,
    overallRating: 7.9,
    selectionStatus: "shortlisted",
    transferStatus: "not_listed",
    photo: player5,
    isActive: true,
  },
  {
    id: "7",
    firstName: "Kylian",
    lastName: "Mbappe",
    position: "Midfielder",
    ageGroup: "U-19",
    team: "Team C",
    coach: "Priya Nair",
    jerseyNumber: 6,
    attendancePercentage: 90,
    overallRating: 7.9,
    selectionStatus: "shortlisted",
    transferStatus: "not_listed",
    photo: player6,
    isActive: true,
  },
];

const selectionBadge: Record<
  SelectionStatus,
  { label: string; variant: "green" | "blue" | "yellow" | "gray" | "red" }
> = {
  selected: { label: "Selected", variant: "green" },
  shortlisted: { label: "Shortlisted", variant: "blue" },
  pending: { label: "Pending", variant: "gray" },
  on_hold: { label: "On Hold", variant: "yellow" },
  not_selected: { label: "Not Selected", variant: "red" },
  released: { label: "Released", variant: "gray" },
};

const transferBadge: Record<
  TransferStatus,
  { label: string; variant: "blue" | "green" | "gray" }
> = {
  listed: { label: "On Transfer", variant: "blue" },
  sold: { label: "Transferred", variant: "green" },
  not_listed: { label: "", variant: "gray" },
};

const getRatingColor = (r: number) =>
  r >= 9
    ? "text-volt-400"
    : r >= 8
      ? "text-field-400"
      : r >= 7
        ? "text-ice-400"
        : "text-slate-400";

type ViewMode = "grid" | "list";

const StudentsPage: React.FC = () => {
  const [search, setSearch] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [filterAge, setFilterAge] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showPhotoCards, setShowPhotoCards] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const { user } = useSelector((s: RootState) => s.auth);
  console.log("Current user:", user);

  const filtered = mockStudents.filter((s) => {
    const name = `${s.firstName} ${s.lastName}`.toLowerCase();
    if (search && !name.includes(search.toLowerCase())) return false;
    if (filterTeam && s.team !== filterTeam) return false;
    if (filterAge && s.ageGroup !== filterAge) return false;
    if (filterStatus && s.selectionStatus !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="section-title mb-1">Management</p>
          <h1 className="font-display font-extrabold text-white text-2xl uppercase tracking-tight">
            Squad
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {mockStudents.length} players enrolled
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<span>⬇</span>}>
            Import CSV
          </Button>
          <Button
            size="sm"
            icon={<span>+</span>}
            onClick={() => setShowAddModal(true)}
          >
            Add Player
          </Button>
        </div>
      </div>

      {/* Filters + view toggle */}
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <Input
            placeholder="Search players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<span className="text-xs">🔍</span>}
          />
        </div>
        <div className="min-w-32">
          <select
            className="input"
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
          >
            <option value="">All Teams</option>
            <option>Team A</option>
            <option>Team B</option>
            <option>Team C</option>
          </select>
        </div>
        <div className="min-w-32">
          <select
            className="input"
            value={filterAge}
            onChange={(e) => setFilterAge(e.target.value)}
          >
            <option value="">All Ages</option>
            {["U-13", "U-15", "U-17", "U-19", "U-21"].map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
        <div className="min-w-40">
          <select
            className="input"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="selected">Selected</option>
            <option value="shortlisted">Shortlisted</option>
            <option value="pending">Pending</option>
            <option value="on_hold">On Hold</option>
            <option value="not_selected">Not Selected</option>
          </select>
        </div>

        {/* View mode toggle */}
        <div className="ml-auto flex items-center gap-2">
          {/* Card face toggle */}
          <button
            onClick={() => setShowPhotoCards((prev) => !prev)}
            className="
      h-10 w-10
      flex items-center justify-center
      rounded-xl
      border border-white/10
      bg-pitch-700
      text-slate-300
      hover:text-white
      hover:border-volt-400/30
      hover:bg-pitch-600
      transition-all duration-300
    "
            title={
              showPhotoCards ? "Show placeholder cards" : "Show player photos"
            }
          >
            {showPhotoCards ? (
              <Shuffle className="h-4 w-4" />
            ) : (
              <Shuffle className="h-4 w-4" />
            )}
          </button>

          {/* View mode toggle */}
          <div className="flex items-center bg-pitch-700 rounded border border-white/10 overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={clsx(
                "px-3 py-2 text-xs transition-colors",
                viewMode === "grid"
                  ? "bg-volt-400 text-pitch-900 font-bold"
                  : "text-slate-400 hover:text-white",
              )}
            >
              ⊞
            </button>

            <button
              onClick={() => setViewMode("list")}
              className={clsx(
                "px-3 py-2 text-xs transition-colors",
                viewMode === "list"
                  ? "bg-volt-400 text-pitch-900 font-bold"
                  : "text-slate-400 hover:text-white",
              )}
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {filtered.length} player{filtered.length !== 1 ? "s" : ""} found
        </p>
        {(search || filterTeam || filterAge || filterStatus) && (
          <button
            onClick={() => {
              setSearch("");
              setFilterTeam("");
              setFilterAge("");
              setFilterStatus("");
            }}
            className="text-xs text-volt-400 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Grid view */}
      {/* Grid view */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
          {filtered.map((student) => (
            <Link
              key={student.id}
              to={`/${user?.role}/students/${student.id}`}
              className="
          relative
          aspect-[2/3]              /* Portrait ratio */
          [perspective:2000px]
          overflow-hidden
          rounded-3xl
          border
          border-white/5
          bg-black
          group
          transition-all
          duration-300
          hover:border-volt-400/30
          hover:-translate-y-1
          hover:shadow-2xl
          hover:shadow-volt-400/10
        "
            >
              {/* Background Container */}
              <div
                className="
            relative h-full w-full
            [transform-style:preserve-3d]
            transition-transform duration-700
          "
                style={{
                  transform: showPhotoCards
                    ? "rotateY(0deg)"
                    : "rotateY(180deg)",
                }}
              >
                {/* FRONT SIDE */}
                <div className="absolute inset-0 rounded-3xl overflow-hidden [backface-visibility:hidden]">
                  <div className="absolute inset-0">
                    {student.photo ? (
                      <img
                        src={student.photo}
                        alt={`${student.firstName} ${student.lastName}`}
                        className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <PlayerPlaceholder
                        image={mannequinPng}
                        name={`${student.firstName} ${student.lastName}`}
                        number={student.jerseyNumber}
                        className="h-full w-full px-6 pb-14"
                        nameTop="28%"
                        numberTop="32%"
                        nameSize="11px"
                        numberSize="65px"
                        nameWidth="75%"
                      />
                    )}
                  </div>

                  {/* Card Content - Scaled down */}
                  <PlayerCardContent
                    student={student}
                    getRatingColor={getRatingColor}
                    selectionBadge={selectionBadge}
                  />
                </div>

                {/* BACK SIDE */}
                <div className="absolute inset-0 rounded-3xl overflow-hidden [transform:rotateY(180deg)] [backface-visibility:hidden]">
                  <div className="absolute inset-0">
                    <PlayerPlaceholder
                      image={mannequinPng}
                      name={`${student.firstName} ${student.lastName}`}
                      number={student.jerseyNumber}
                      className="h-full w-full px-6 pb-14"
                      nameTop="30%"
                      numberTop="36%"
                      nameSize="11px"
                      numberSize="65px"
                      nameWidth="75%"
                    />
                  </div>

                  <PlayerCardContent
                    student={student}
                    getRatingColor={getRatingColor}
                    selectionBadge={selectionBadge}
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* List view */}
      {viewMode === "list" && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-3 section-title">Player</th>
                <th className="text-left px-4 py-3 section-title hidden sm:table-cell">
                  Position
                </th>
                <th className="text-left px-4 py-3 section-title hidden md:table-cell">
                  Team
                </th>
                <th className="text-center px-4 py-3 section-title">Rating</th>
                <th className="text-center px-4 py-3 section-title hidden lg:table-cell">
                  Attendance
                </th>
                <th className="text-left px-4 py-3 section-title hidden xl:table-cell">
                  Status
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((student, i) => (
                <tr
                  key={student.id}
                  className={clsx(
                    "border-b border-white/4 hover:bg-white/2 transition-colors",
                    i % 2 === 0 && "bg-white/1",
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={`${student.firstName} ${student.lastName}`}
                        src={student.photo}
                        size="sm"
                      />
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {student.firstName} {student.lastName}
                        </p>
                        <p className="text-2xs text-slate-500">
                          #{student.jerseyNumber} · {student.ageGroup}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400 hidden sm:table-cell">
                    {student.position}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400 hidden md:table-cell">
                    {student.team}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={clsx(
                        "font-display font-extrabold text-lg",
                        getRatingColor(student.overallRating),
                      )}
                    >
                      {student.overallRating.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center hidden lg:table-cell">
                    <span
                      className={
                        student.attendancePercentage >= 90
                          ? "text-field-400 text-sm font-semibold"
                          : student.attendancePercentage >= 75
                            ? "text-volt-400 text-sm font-semibold"
                            : "text-ember-400 text-sm font-semibold"
                      }
                    >
                      {student.attendancePercentage}%
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    <Badge
                      variant={selectionBadge[student.selectionStatus].variant}
                    >
                      {selectionBadge[student.selectionStatus].label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/students/${student.id}`}
                      className="text-xs text-volt-400 hover:underline"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <EmptyState
              icon="⚽"
              title="No players found"
              description="Try adjusting your filters"
            />
          )}
        </div>
      )}

      {/* Add Student Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Enroll New Player"
        size="lg"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="First Name" placeholder="Arjun" />
          <Input label="Last Name" placeholder="Mehta" />
          <Input label="Date of Birth" type="date" />
          <div>
            <label className="label">Age Group</label>
            <select className="input">
              {["U-13", "U-15", "U-17", "U-19", "U-21"].map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Position</label>
            <select className="input">
              {["Forward", "Midfielder", "Defender", "Goalkeeper"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <Input label="Jersey Number" type="number" placeholder="9" />
          <Input
            label="Guardian Email"
            type="email"
            placeholder="parent@email.com"
          />
          <Input
            label="Emergency Contact Phone"
            type="tel"
            placeholder="+91 9876543210"
          />
          <div className="sm:col-span-2">
            <Input
              label="Medical Notes (Optional)"
              placeholder="Allergies, conditions..."
            />
          </div>
          <div className="sm:col-span-2 flex gap-3 pt-2">
            <Button
              className="flex-1"
              onClick={() => {
                toast.success("Player enrolled!");
                setShowAddModal(false);
              }}
            >
              Enroll Player
            </Button>
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default StudentsPage;
