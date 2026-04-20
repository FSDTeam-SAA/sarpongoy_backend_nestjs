import { PartialType } from '@nestjs/swagger';
import { CreateExclesheetDto } from './create-exclesheet.dto';

export class UpdateExclesheetDto extends PartialType(CreateExclesheetDto) {}
