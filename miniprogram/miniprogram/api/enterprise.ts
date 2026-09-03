import { request } from './request';

export interface EnterpriseCategory { id:string; name:string; icon?:string; projects?:EnterpriseProject[]; }
export interface EnterpriseProject { id:string; categoryId:string; name:string; description?:string; }
export interface EnterpriseDoctor { id:string; name:string; avatar:string; title:string; displayText?:string; departmentId:string; specialty:string; description:string; images:string[]; hospital?:string; recommend:boolean; department?:EnterpriseCategory; departments?:EnterpriseCategory[]; clinic?:{id:string;name:string;address?:string}; schedules?:EnterpriseSchedule[]; }
export interface EnterpriseSchedule { id:string; date:string; timeSlot:string; capacity:number; bookedCount:number; status:string; clinic?:{id:string;name:string;address?:string}; }
export interface EnterprisePackage { id:string; categoryId:string; title:string; cover:string; originalPrice:string; salePrice:string; salesCount:number; description:string; category?:EnterpriseCategory; images?:Array<{id:string;imageUrl:string;sort:number}>; }
export interface EnterpriseAppointment { id:string; appointmentNo:string; type:string; typeText:string; name:string; phoneMasked:string; doctor?:EnterpriseDoctor|null; dentalCategory?:EnterpriseCategory|null; dentalProject?:EnterpriseProject|null; package?:EnterprisePackage|null; clinic?:{id:string;name:string;address?:string}|null; appointmentDate?:string; appointmentTime?:string; symptomDescription?:string; gender?:string; createdAt:string; expectedContactTime:string; }
export interface EnterpriseHome { config:{hospitalName:string;slogan:string;logo:string;customerServicePath:string}; banners:Array<{id:string;imageUrl:string;title:string;linkType:string;linkValue?:string}>; ads:Array<{id:string;imageUrl:string;title:string;linkType:string;linkValue?:string}>; categories:EnterpriseCategory[]; doctors:EnterpriseDoctor[]; }
export interface EnterpriseProfile { id:string; name?:string; phoneMasked?:string; hasPhone:boolean; subscribedOfficialAccount:boolean; hospitalName?:string; officialAccountName?:string; }

export const getEnterpriseHome=()=>request<EnterpriseHome>({url:'/api/enterprise/home'});
export const getEnterpriseCategories=()=>request<EnterpriseCategory[]>({url:'/api/enterprise/categories'});
export const getEnterpriseDoctors=(departmentId='')=>request<EnterpriseDoctor[]>({url:'/api/enterprise/doctors',data:departmentId?{departmentId}:{}});
export const getEnterpriseDoctor=(id:string)=>request<EnterpriseDoctor>({url:`/api/enterprise/doctors/${id}`});
export const getEnterprisePackages=(categoryId='')=>request<{categories:EnterpriseCategory[];packages:EnterprisePackage[]}>({url:'/api/enterprise/packages',data:categoryId?{categoryId}:{}});
export const getEnterprisePackage=(id:string)=>request<EnterprisePackage>({url:`/api/enterprise/packages/${id}`});
export const createDoctorAppointment=(data:WechatMiniprogram.IAnyObject)=>request<EnterpriseAppointment>({url:'/api/enterprise/appointments/doctor',method:'POST',auth:true,data});
export const createPackageApplication=(data:WechatMiniprogram.IAnyObject)=>request<EnterpriseAppointment>({url:'/api/enterprise/appointments/package',method:'POST',auth:true,data});
export const getEnterpriseRecords=(type='')=>request<EnterpriseAppointment[]>({url:'/api/enterprise/records/my',auth:true,data:type?{type}:{}});
export const getEnterpriseProfile=()=>request<EnterpriseProfile>({url:'/api/enterprise/profile',auth:true});
