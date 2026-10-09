// Private simulation state: never included in the player projection.
export function refreshRecruitment(state){
 state.recruitmentPools??={};
 for(const building of [...state.buildings].sort((a,b)=>a.id.localeCompare(b.id))){
  const pool=state.recruitmentPools[building.id]??={available:2,refreshedWeek:state.week};
  const periods=Math.max(0,Math.floor((state.week-pool.refreshedWeek)/2));
  pool.available=Math.min(2,pool.available+periods);
  pool.refreshedWeek+=periods*2;
 }
}
