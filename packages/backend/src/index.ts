export { FlexDocModule } from './flexdoc.module';
export { FlexDocService } from './flexdoc.service';
export { FlexDocOptions, FlexDocModuleOptions } from './interfaces';
export { setupFlexDoc } from './setup';
export { setupExpressFlexDoc, setupFastifyFlexDoc, setupFastifySwaggerFlexDoc, setupNestFlexDoc } from './framework-adapters';
export type { ExpressLikeApplication, FastifyLikeApplication, FastifyLikeReply, FastifyLikeRequest, NestLikeApplication } from './framework-adapters';
