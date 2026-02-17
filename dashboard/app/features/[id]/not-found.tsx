import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function FeatureNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="mt-2 text-muted-foreground">Feature not found</p>
      <Link href="/" className="mt-6">
        <Button variant="outline">Back to Dashboard</Button>
      </Link>
    </div>
  );
}
