"""Regenerate publication figures and summary tables from measured CSV files."""
from pathlib import Path
import math
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
FIG = ROOT / "figures"
FIG.mkdir(parents=True, exist_ok=True)

BLUE = "#315d8a"
TEAL = "#287f83"
PALE = "#eaf0f5"
TEXT = "#1d2d3e"
GRAY = "#64748b"
plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 8, "text.color": TEXT,
    "axes.labelcolor": TEXT, "axes.edgecolor": "#97a5b3",
    "xtick.color": TEXT, "ytick.color": TEXT,
    "axes.spines.top": False, "axes.spines.right": False,
    "figure.facecolor": "white", "axes.facecolor": "white",
    "savefig.facecolor": "white", "svg.fonttype": "none",
})

def save(fig, stem):
    for ext in ("png", "svg", "pdf"):
        fig.savefig(FIG / f"{stem}.{ext}", dpi=300, bbox_inches="tight", pad_inches=0.09)
    plt.close(fig)

def wilson(successes, trials, z=1.959963984540054):
    p = successes / trials
    den = 1 + z*z/trials
    center = (p + z*z/(2*trials))/den
    half = z*math.sqrt(p*(1-p)/trials + z*z/(4*trials*trials))/den
    return center-half, center+half

reload = pd.read_csv(DATA / "reload_comparison_trials.csv")
render = pd.read_csv(DATA / "graffiti_render_trials.csv")
scope = pd.read_csv(DATA / "graffiti_export_scope.csv")
order = ["Graffiti", "Excalidraw", "draw.io", "tldraw", "Whitebophir"]

recover_rows = []
for system in order:
    x = reload.loc[reload.system == system, "restored"].astype(bool)
    low, high = wilson(int(x.sum()), len(x))
    recover_rows.append({"system":system,"successes":int(x.sum()),"trials":len(x),
                         "observed_percent":100*x.mean(),"wilson_95_low_percent":100*low,
                         "wilson_95_high_percent":100*high})
recover = pd.DataFrame(recover_rows)
recover.to_csv(DATA / "reload_comparison_summary.csv", index=False, float_format="%.3f")

fig, ax = plt.subplots(figsize=(3.75, 2.55))
y = np.arange(len(order))[::-1]
for index, row in recover.iterrows():
    yy = y[index]
    ax.plot([row.wilson_95_low_percent, row.wilson_95_high_percent], [yy, yy],
            color=BLUE, linewidth=2.2, solid_capstyle="round")
    ax.plot(row.observed_percent, yy, "o", color=TEAL, markersize=6)
    ax.annotate(f"{row.successes}/{row.trials}", (100,yy), xytext=(9,0),
                textcoords="offset points", va="center", fontsize=7.6,
                color=TEXT, clip_on=False)
ax.set_yticks(y, order)
ax.set_xlim(0, 100)
ax.set_xticks([0, 25, 50, 75, 100])
ax.set_xlabel("Immediate reload recovery (%)")
ax.grid(axis="x", color=PALE, linewidth=0.8)
ax.set_axisbelow(True)
fig.subplots_adjust(left=0.29, right=0.84, bottom=0.20, top=0.97)
save(fig, "fig06_reload_recovery_measured")

render_rows = []
counts = [0, 100, 500, 1000]
for count in counts:
    values = render.loc[render.objects == count, "response_to_ready_ms"].to_numpy()
    render_rows.append({"objects":count,"trials":len(values),
                        "median_ms":np.median(values),"q1_ms":np.percentile(values,25),
                        "q3_ms":np.percentile(values,75),"p95_ms":np.percentile(values,95),
                        "minimum_ms":np.min(values),"maximum_ms":np.max(values)})
summary = pd.DataFrame(render_rows)
summary.to_csv(DATA / "graffiti_ready_summary.csv", index=False, float_format="%.3f")

fig, ax = plt.subplots(figsize=(3.55, 2.70))
groups = [render.loc[render.objects == n,"response_to_ready_ms"].to_numpy() for n in counts]
bp = ax.boxplot(groups, positions=range(len(counts)), widths=0.48,
                patch_artist=True, showfliers=True,
                boxprops={"facecolor":PALE,"edgecolor":BLUE,"linewidth":1.1},
                medianprops={"color":TEAL,"linewidth":2},
                whiskerprops={"color":BLUE}, capprops={"color":BLUE},
                flierprops={"marker":"o","markersize":3,"markerfacecolor":GRAY,"markeredgecolor":GRAY})
for i, vals in enumerate(groups):
    offsets=np.linspace(-0.12,0.12,len(vals))
    ax.scatter(np.full(len(vals),i)+offsets,vals,s=10,color=BLUE,alpha=0.55,zorder=3)
    ax.text(i+0.27,np.median(vals)+7,f"{np.median(vals):.0f}",fontsize=7,color=TEAL)
ax.set_xticks(range(len(counts)), [str(n) for n in counts])
ax.set_xlabel("Objects in Graffiti fixture")
ax.set_ylabel("Response end to board ready (ms)")
ax.set_ylim(170, 850)
ax.grid(axis="y",color=PALE,linewidth=0.8)
ax.set_axisbelow(True)
fig.subplots_adjust(left=0.22,right=0.97,bottom=0.23,top=0.98)
save(fig,"fig07_graffiti_board_ready_measured")

def value(variant, kind, field):
    return int(scope.loc[(scope.variant == variant) & (scope.format == kind), field].iloc[0])

fig, (ax1,ax2)=plt.subplots(1,2,figsize=(7.16,2.70),gridspec_kw={"width_ratios":[1.3,1]})
variants=["visible","offscreen","two_pages"]
labels=["1 visible shape","+1 offscreen shape","+1 second-page shape"]
x=np.arange(3); width=0.22
input_counts=[1,2,2]
svg_counts=[value(v,"SVG","rectangles") for v in variants]
json_counts=[value(v,"JSON","rectangles") for v in variants]
for offset,vals,label,color in [(-width,input_counts,"Input",GRAY),
                                (0,svg_counts,"SVG",BLUE),
                                (width,json_counts,"JSON",TEAL)]:
    bars=ax1.bar(x+offset,vals,width,label=label,color=color)
    ax1.bar_label(bars,padding=2,fontsize=7)
ax1.set_xticks(x,labels,fontsize=7)
ax1.set_ylim(0,2.45)
ax1.set_yticks([0,1,2])
ax1.set_ylabel("Shapes in structural output")
ax1.legend(frameon=False,ncol=3,loc="upper left",fontsize=7)
ax1.grid(axis="y",color=PALE)
ax1.set_axisbelow(True)
ax1.set_title("A. Object preservation",loc="left",fontweight="bold",fontsize=9)

page_labels=["Input","PNG","SVG","JSON"]
page_values=[2,1,value("two_pages","SVG","pages"),value("two_pages","JSON","pages")]
bars=ax2.bar(range(4),page_values,color=[GRAY,BLUE,BLUE,TEAL],width=0.52)
ax2.bar_label(bars,padding=2,fontsize=8)
ax2.set_xticks(range(4),page_labels)
ax2.set_yticks([0,1,2]);ax2.set_ylim(0,2.45)
ax2.set_ylabel("Pages represented")
ax2.grid(axis="y",color=PALE);ax2.set_axisbelow(True)
ax2.set_title("B. Two-page fixture",loc="left",fontweight="bold",fontsize=9)
fig.subplots_adjust(left=0.07,right=0.98,bottom=0.20,top=0.86,wspace=0.30)
save(fig,"fig08_graffiti_export_scope_measured")

print(recover.to_string(index=False,float_format=lambda v:f"{v:.2f}"))
print(summary.to_string(index=False,float_format=lambda v:f"{v:.2f}"))
print("PNG hashes equal (visible/offscreen):",scope.loc[(scope.variant=="visible")&(scope.format=="PNG"),"sha256"].iloc[0]
      ==scope.loc[(scope.variant=="offscreen")&(scope.format=="PNG"),"sha256"].iloc[0])
