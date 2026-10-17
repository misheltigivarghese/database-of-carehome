import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";

export function NotFoundPage() {
  return (
    <div className="py-8">
      <EmptyState
        icon={<Compass aria-hidden="true" className="size-5" />}
        title="That page doesn't exist"
        description="The link may be out of date, or the page may have moved. Head back to the resident list to keep going."
        action={
          <Link to="/residents">
            <Button>Back to residents</Button>
          </Link>
        }
      />
    </div>
  );
}
