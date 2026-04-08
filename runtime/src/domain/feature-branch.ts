export function deriveFeatureBranchName(featureId: string, devInitials?: string): string {
  const trimmed_feature_id = featureId.trim();
  const trimmed_initials = devInitials?.trim();

  if (trimmed_initials == null || trimmed_initials.length === 0) {
    return `feature/${trimmed_feature_id}`;
  }

  return `${trimmed_initials}/feature/${trimmed_feature_id}`;
}
