import { afterEach, expect, it, vi } from 'vitest'
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();delete window.APP_CONFIG})
it('uses the configured API prefix and never forwards dashboard cookies',async()=>{
 window.APP_CONFIG={apiBaseUrl:'https://api.example/public'}
 const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({status:'ok'}),{headers:{'Content-Type':'application/json'}}))
 vi.stubGlobal('fetch',fetcher)
 const {fetchJson}=await import('./platformApi')
 expect(await fetchJson('/api/health')).toEqual({status:'ok'})
 const [url,options]=fetcher.mock.calls[0]
 expect(url).toBe('https://api.example/public/api/health')
 expect(options.credentials).toBe('omit')
})
it('uses the edge service only for scoreboards', async () => {
 window.APP_CONFIG={apiBaseUrl:'https://details.example', scoresApiBaseUrl:'https://scores.example'}
 const fetcher=vi.fn(async()=>Response.json({}))
 vi.stubGlobal('fetch',fetcher)
 const {loadSportsScores, loadMatchDetails}=await import('../features/overview/sportsApi')
 await loadSportsScores(['soccer/ger.1'],'20261123')
 await loadMatchDetails('soccer/ger.1','123')
 expect(fetcher.mock.calls.map(call=>String((call as unknown[])[0]).split('/api/')[0])).toEqual(['https://scores.example','https://details.example'])
})
it('reports data-source errors instead of returning invented data',async()=>{
 window.APP_CONFIG={apiBaseUrl:'https://api.example'}
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({error:'Source unavailable'}),{status:502})))
 const {fetchJson}=await import('./platformApi')
 await expect(fetchJson('/api/health')).rejects.toThrow('Source unavailable')
})
