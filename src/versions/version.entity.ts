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

@Entity({ name: 'app_versions' })
@Index(['projectId', 'platform', 'buildNumber'], { unique: true })
@Index(['projectId', 'platform', 'isActive'])
export class AppVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @Column({ type: 'enum', enum: AppPlatform })
  platform!: AppPlatform;

  @Column({ type: 'varchar', length: 50 })
  version!: string;

  @Column({ name: 'build_number', type: 'integer' })
  buildNumber!: number;

  @Column({ name: 'download_url', type: 'text' })
  downloadUrl!: string;

  @Column({ name: 'storage_key', type: 'text' })
  storageKey!: string;

  @Column({ name: 'file_size', type: 'integer' })
  fileSize!: number;

  @Column({ name: 'release_notes', type: 'text', default: '' })
  releaseNotes!: string;

  @Column({ name: 'is_required', type: 'boolean', default: false })
  isRequired!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive!: boolean;

  @Column({ name: 'min_supported_build', type: 'integer', default: 0 })
  minSupportedBuild!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;
}