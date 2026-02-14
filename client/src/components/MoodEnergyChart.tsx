import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Waves, Zap } from "lucide-react";

interface EnergyCurvePoint {
  timestamp: string;
  level: number;
  description: string;
}

interface Section {
  name: string;
  startTime: string;
  endTime: string;
  energy: number;
  description: string;
}

interface MoodEnergyData {
  energyCurve: EnergyCurvePoint[];
  overallEnergy: string;
  dynamicRange: string;
  mood: string[];
  sections: Section[];
  arrangement: {
    density?: string;
    layering?: string;
    transitions?: string;
    buildAndRelease?: string;
  };
}

function EnergyBar({ level, maxLevel = 10 }: { level: number; maxLevel?: number }) {
  const pct = (level / maxLevel) * 100;
  const color = level >= 8 ? "bg-red-500" : level >= 6 ? "bg-orange-400" : level >= 4 ? "bg-amber-400" : level >= 2 ? "bg-emerald-400" : "bg-sky-400";
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function EnergyTimeline({ curve }: { curve: EnergyCurvePoint[] }) {
  if (!curve || curve.length === 0) return <p className="text-sm text-muted-foreground">No energy data available</p>;
  const maxEnergy = Math.max(...curve.map(c => c.level), 1);
  return (
    <div className="space-y-1.5">
      {curve.map((point, i) => (
        <div key={i} className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground font-mono text-xs w-20 shrink-0">{point.timestamp}</span>
          <div className="flex-1">
            <EnergyBar level={point.level} maxLevel={maxEnergy} />
          </div>
          <span className="text-xs text-muted-foreground w-6 text-right">{point.level}</span>
        </div>
      ))}
    </div>
  );
}

function SectionMap({ sections }: { sections: Section[] }) {
  if (!sections || sections.length === 0) return null;
  const colors: Record<string, string> = {
    Intro: "bg-sky-500/20 border-sky-500/40 text-sky-300",
    Verse: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300",
    "Pre-Chorus": "bg-amber-500/20 border-amber-500/40 text-amber-300",
    Chorus: "bg-red-500/20 border-red-500/40 text-red-300",
    Bridge: "bg-purple-500/20 border-purple-500/40 text-purple-300",
    Outro: "bg-slate-500/20 border-slate-500/40 text-slate-300",
    Instrumental: "bg-indigo-500/20 border-indigo-500/40 text-indigo-300",
    Breakdown: "bg-orange-500/20 border-orange-500/40 text-orange-300",
    Build: "bg-yellow-500/20 border-yellow-500/40 text-yellow-300",
    Drop: "bg-pink-500/20 border-pink-500/40 text-pink-300",
    Solo: "bg-teal-500/20 border-teal-500/40 text-teal-300",
    Interlude: "bg-cyan-500/20 border-cyan-500/40 text-cyan-300",
  };
  const getColor = (name: string) => {
    for (const [key, val] of Object.entries(colors)) {
      if (name.toLowerCase().includes(key.toLowerCase())) return val;
    }
    return "bg-muted border-border text-muted-foreground";
  };

  return (
    <div className="space-y-2">
      {/* Visual section bar */}
      <div className="flex gap-0.5 h-8 rounded-lg overflow-hidden">
        {sections.map((s, i) => {
          const color = getColor(s.name);
          const bgClass = color.split(" ")[0];
          return (
            <div
              key={i}
              className={`${bgClass} flex items-center justify-center text-[10px] font-medium px-1 min-w-[30px]`}
              style={{ flex: s.energy || 1 }}
              title={`${s.name} (${s.startTime}–${s.endTime}): Energy ${s.energy}/10`}
            >
              {s.name.length <= 8 ? s.name : s.name.substring(0, 6) + "…"}
            </div>
          );
        })}
      </div>
      {/* Section details */}
      <div className="grid gap-2">
        {sections.map((s, i) => (
          <div key={i} className={`flex items-center gap-3 p-2 rounded-lg border ${getColor(s.name)}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{s.name}</span>
                <span className="text-xs opacity-70">{s.startTime} – {s.endTime}</span>
              </div>
              <p className="text-xs opacity-70 truncate">{s.description}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Zap className="h-3 w-3" />
              <span className="text-sm font-mono">{s.energy}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MoodEnergyChart({ data }: { data: MoodEnergyData }) {
  return (
    <div className="space-y-4">
      {/* Overview stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/40">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Activity className="h-3.5 w-3.5" /> Overall Energy
            </div>
            <p className="text-sm font-semibold capitalize">{data.overallEnergy}</p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Waves className="h-3.5 w-3.5" /> Dynamic Range
            </div>
            <p className="text-sm font-semibold capitalize">{data.dynamicRange}</p>
          </CardContent>
        </Card>
        <Card className="border-border/40 col-span-2">
          <CardContent className="py-3 px-4">
            <div className="text-xs text-muted-foreground mb-1.5">Mood</div>
            <div className="flex flex-wrap gap-1.5">
              {data.mood.map((m, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{m}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Energy curve */}
      <Card className="border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Energy Curve
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EnergyTimeline curve={data.energyCurve} />
        </CardContent>
      </Card>

      {/* Section map */}
      <Card className="border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Song Structure Map</CardTitle>
        </CardHeader>
        <CardContent>
          <SectionMap sections={data.sections} />
        </CardContent>
      </Card>

      {/* Arrangement details */}
      {data.arrangement && (
        <Card className="border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Arrangement Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {data.arrangement.density && (
                <div>
                  <span className="text-muted-foreground text-xs">Density</span>
                  <p className="font-medium capitalize">{data.arrangement.density}</p>
                </div>
              )}
              {data.arrangement.layering && (
                <div>
                  <span className="text-muted-foreground text-xs">Layering</span>
                  <p className="font-medium">{data.arrangement.layering}</p>
                </div>
              )}
              {data.arrangement.transitions && (
                <div>
                  <span className="text-muted-foreground text-xs">Transitions</span>
                  <p className="font-medium">{data.arrangement.transitions}</p>
                </div>
              )}
              {data.arrangement.buildAndRelease && (
                <div>
                  <span className="text-muted-foreground text-xs">Build & Release</span>
                  <p className="font-medium">{data.arrangement.buildAndRelease}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
