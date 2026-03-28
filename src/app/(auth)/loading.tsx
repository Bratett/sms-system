import { LoadingSpinner } from "@/components/shared/loading-spinner";

export default function AuthLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <LoadingSpinner size="lg" className="text-primary" />
    </div>
  );
}
