import './ui/styles.css';
import {startPanel} from './bootstrap.ts';
import {PresetRepository} from './domain/presetStorage.ts';
import {UxpFs} from './host/uxpFs.ts';
import {UxpHostBridge} from './host/uxpHost.ts';
import {PremiereAdapter} from './host/premiereAdapter.ts';
import {UxpUserInteraction} from './host/userInteraction.ts';
async function main():Promise<void>{
 const app=document.getElementById('app');if(!app)throw new Error('Missing app container');
 await startPanel(app,{repo:new PresetRepository(new UxpFs(),'statemotion-panel-data'),adapter:new PremiereAdapter(new UxpHostBridge()),interaction:new UxpUserInteraction()});
}
main().catch(()=>{const app=document.getElementById('app');if(app)app.textContent='StateMotion could not load. Reopen the panel or inspect the developer console.';});
