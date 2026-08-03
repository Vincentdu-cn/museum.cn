import * as React from "react"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

const Rating = React.forwardRef(({ className, value = 0, onChange, max = 5, ...props }, ref) => {
  const [hover, setHover] = React.useState(0)

  return (
    <div ref={ref} className={cn("flex items-center gap-1", className)} {...props}>
      {[...Array(max)].map((_, index) => {
        const ratingValue = index + 1
        return (
          <button
            key={index}
            type="button"
            className="p-0 transition-transform hover:scale-110"
            onClick={() => onChange && onChange(ratingValue)}
            onMouseEnter={() => setHover(ratingValue)}
            onMouseLeave={() => setHover(0)}
            disabled={!onChange}
          >
            <Star
              className={cn(
                "h-5 w-5",
                ratingValue <= (hover || value)
                  ? "fill-amber-400 text-amber-400"
                  : "fill-none text-gray-300"
              )}
            />
          </button>
        )
      })}
    </div>
  )
})
Rating.displayName = "Rating"

export { Rating }
