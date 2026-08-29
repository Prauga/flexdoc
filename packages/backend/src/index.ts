export { FlexDocModule } from './flexdoc.module';
export { FlexDocService } from './flexdoc.service';
export { FlexDocOptions, FlexDocModuleOptions } from './interfaces';
export { setupFlexDoc } from './setup';
export { setupExpressFlexDoc, setupFastifyFlexDoc } from './framework-adapters';
export type { ExpressLikeApplication, FastifyLikeApplication, FastifyLikeReply, FastifyLikeRequest } from './framework-adapters';
