/** Render on every host rAF. Reduce pixel work only after sustained pressure,
 * recover slowly, and ignore discontinuities caused by tab/viewport changes. */
export class PixelBudget {
  scale=1
  private mean=16.7
  private slow=0
  private fast=0
  reset(){this.mean=16.7;this.slow=this.fast=0}
  sample(dt:number){
    if(!(dt>0)||dt>140){this.reset();return false}
    this.mean+=(dt-this.mean)*.09
    this.slow=this.mean>23.5?this.slow+dt:Math.max(0,this.slow-dt)
    this.fast=this.mean<17.9?this.fast+dt:0
    const initial=this.scale
    if(this.slow>1000){this.scale=Math.max(.68,this.scale-.12);this.slow=this.fast=0}
    else if(this.fast>5200){this.scale=Math.min(1,this.scale+.06);this.slow=this.fast=0}
    return Math.abs(this.scale-initial)>.001
  }
}
