import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { AppPlatform } from '../common/enums/platform.enum';
import { Project } from '../projects/project.entity';

@Entity({ name: 'logs' })
@Index(['projectId', 'platform', 'createdAt'])
export class UpdateLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @Column({ type: 'enum', enum: AppPlatform })
  platform!: AppPlatform;

  @Column({ name: 'current_version', type: 'varchar', length: 50, nullable: true })
  currentVersion!: string | null;

  @Column({ name: 'current_build', type: 'integer' })
  currentBuild!: number;

  @Column({ type: 'varchar', length: 128, nullable: true })
  ip!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;
}