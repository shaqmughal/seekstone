# Fourier'S Series

FOURIER'S SERIES, in mathematics, those series which proceed according
to sines and cosines of multiples of a variable, the various multiples
being in the ratio of the natural numbers; they are used for the
representation of a function of the variable for values of the variable
which lie between prescribed finite limits. Although the importance of
such series, especially in the theory of vibrations, had been recognized
by D. Bernoulli, Lagrange and other mathematicians, and had led to some
discussion of their properties, J.B.J. Fourier (see above) was the first
clearly to recognize the arbitrary character of the functions which the
series can represent, and to make any serious attempt to prove the
validity of such representation; the series are consequently usually
associated with the name of Fourier. More general cases of
trigonometrical series, in which the multiples are given as the roots of
certain transcendental equations, were also considered by Fourier.

  Before proceeding to the consideration of the special class of series
  to be discussed, it is necessary to define with some precision what is
  to be understood by the representation of an arbitrary function by an
  infinite series. Suppose a function of a variable x to be arbitrarily
  given for values of x between two fixed values a and b; this means
  that, corresponding to every value of x such that a <= x <= b, a
  definite arithmetical value of the function is assigned by means of
  some prescribed set of rules. A function so defined may be denoted by
  [f](x); the rules by which the values of the function are determined
  may be embodied in a single explicit analytical formula, or in several
  such formulae applicable to different portions of the interval, but it
  would be an undue restriction of the nature of an arbitrarily given
  function to assume _a priori_ that it is necessarily given in this
  manner, the possibility of the representation of such a function by
  means of a single analytical expression being the very point which we
  have to discuss. The variable x may be represented by a point at the
  extremity of an interval measured along a straight line from a fixed
  origin; thus we may speak of the point c as synonymous with the value
  x = c of the variable, and of [f](c) as the value of the function
  assigned to the point c. For any number of points between a and b the
  function may be discontinuous, i.e. it may at such points undergo
  abrupt changes of value; it will here be assumed that the number of
  such points is finite. The only discontinuities here considered will
  be those known as ordinary discontinuities. Such a discontinuity
  exists at the point c if [f](c + [epsilon]), [f](c - [epsilon]) have
  distinct but definite limiting values as [epsilon] is indefinitely
  diminished; these limiting values are known as the limits on the right
  and on the left respectively of the function at c, and may be denoted
  by [f](c + 0), [f](c - 0). The discontinuity consists therefore of a
  sudden change of value of the function from [f](c - 0) to [f](c + 0),
  as x increases through the value c. If there is such a discontinuity
  at the point x = 0, we may denote the limits on the right and on the
  left respectively by [f](+0), [f](-0).

  Suppose we have an infinite series u1(x) + u2(x) + ... + u_n(x) + ...
  in which each term is a function of x, of known analytical form; let
  any value x = c(a = c = b) be substituted in the terms of the series,
  and suppose the sum of n terms of the arithmetical series so obtained
  approaches a definite limit as n is indefinitely increased; this limit
  is known as the sum of the series. If for every value of c such that a
  <= c <= b the sum exists and agrees with the value of [f](c), the
  series [Sigma] [1 to [oo]] u_n(x) is said to represent the function
  ([f]x) between the values a, b of the variable. If this is the case
  for all points within the given interval with the exception of a
  finite number, at any one of which either the series has no sum, or
  has a sum which does not agree with the value of the function, the
  series is said to represent "in general" the function for the given
  interval. If the sum of n terms of the series be denoted by S_n(c),
  the condition that S_n(c) converges to the value [f](c) is that,
  corresponding to any finite positive number [delta] as small as we
  please, a value n1 of n can be found such that if n >= n_1, |[f](c) -
  Sn(c)| < [delta].

  Functions have also been considered which for an infinite number of
  points within the given interval have no definite value, and series
  have also been discussed which at an infinite number of points in the
  interval cease either to have a sum, or to have one which agrees with
  the value of the function; the narrower conception above will however
  be retained in the treatment of the subject in this article, reference
  to the wider class of cases being made only in connexion with the
  history of the theory of Fourier's Series.

  _Uniform Convergence of Series._--If the series u1(x) + u2(x) + ... +
  u2(x) + ... converge for every value of x in a given interval a to b,
  and its sum be denoted by S(x), then if, corresponding to a finite
  positive number [delta], as small as we please, a finite number n1 can
  be found such that the arithmetical value of S(x) - S_n(x), where n =>
  n1 is less than [delta] for every value of x in the given interval,
  the series is said to converge uniformly in that interval. It may
  however happen that as x approaches a particular value the number of
  terms of the series which must be taken so that |S(x) - S_n(x)| may be
  < [delta], increases indefinitely; the convergence of the series is
  then infinitely slow in the neighbourhood of such a point, and the
  series is not uniformly convergent throughout the given interval,
  although it converges at each point of the interval. If the number of
  such points in the neighbourhood of which the series ceases to
  converge uniformly be finite, they may be excluded by taking intervals
  of finite magnitude as small as we please containing such points, and
  considering the convergence of the series in the given interval with
  such sub-intervals excluded; the convergence of the series is now
  uniform throughout the remainder of the interval. The series is said
  to be _in general_ uniformly convergent within the given interval a to
  b if it can be made uniformly convergent by the exclusion of a finite
  number of portions of the interval, each such portion being
  arbitrarily small. It is known that the sum of an infinite series of
  continuous terms can be discontinuous only at points in the
  neighbourhood of which the convergence of the series is not uniform,
  but non-uniformity of convergence of the series does not necessarily
  imply discontinuity in the sum.

  _Form of Fourier's Series._--If it be assumed that a function [f](x)
  arbitrarily given for values of x such that o[<=]x[<=]l is capable of
  being represented in general by an infinite series of the form

           [pi]x          2[pi]x                 n[pi]x
    A1 sin ----- + A2 sin ------ + ... + A_n sin ------ + ...,
             l              l                      l

  and if it be further assumed that the series is in general uniformly
  convergent throughout the interval 0 to l, the form of the
  coefficients A can be determined. Multiply each term of the series by
  sin n[pi]x/l, and integrate the product between the limits 0 and l,
  then in virtue of the property [int][l to 0] sin n[pi]x/l sin
  n'[pi]x/l dx=0, or 1/2 l, according as n' is not, or is, equal to n,
  we have -1/2 lA_n= [int][0 to l] [f](x) sin n[pi]x/l dx, and thus the
  series is of the form

                             _
    2       [oo]    n[pi]x  / l        n[pi]x
    -- [Sigma]  sin ------  |   [f](x) ------ dx.        (1)
    l        1         l   _/ 0           l

  This method of determining the coefficients in the series would not be
  valid without the assumption that the series is in general uniformly
  convergent, for in accordance with a known theorem the sum of the
  integrals of the separate terms of the series is otherwise not
  necessarily equal to the integral of the sum. This assumption being
  made, it is further assumed that [f](x) is such that [integral][0 to
  l] [f](x)sin n[pi]x/l dx has a definite meaning for every value of n.

  Before we proceed to examine the justification for the assumptions
  made, it is desirable to examine the result obtained, and to deduce
  other series from it. In order to obtain a series of the form

                [pi]x          2[pi]x                 n[pi]x
    B0 + B1 cos ----- + B2 cos ------ + ... + B_n cos ------ + ...
                  l               l                      l

  for the representation of [f](x) in the interval 0 to l, let us apply
  the series (1) to represent the function [f](x) sin [pi]x/l; we thus
  find
                           _
    2      [oo]    n[pi]x / l          [pi]x     n[pi]x
    -- [Sigma] sin ------ |  [f](x)sin ----- sin ------ dx,
    l        1       l   _/ 0            l          l

  or
                           _         _                                   _
    1      [oo]    n[pi]x / l       |     (n - 1)[pi]x       (n + 1)[pi]x |
    -- [Sigma] sin ------ |  [f](x) | cos ------------ - cos ------------ | dx.
    l        1        l  _/ 0       |_         l                   l     _|

  On rearrangement of the terms this becomes
                  _                                              _
    1      [pi]x / l            2              [pi]x     n[pi]x / l           n[pi]x
    -- sin ----- |  [f](x) dx + -- [Sigma] sin ----- cos ------ |  [f](x) cos ------ dx.
    l        l  _/ 0            l                l         l   _/ 0              l

  hence [f](x) is represented for the interval 0 to l by the series of cosines
        _                                    _
    1  / l            2      [oo]    n[pi]x / l           n[pi]x
    -- |  [f](x) dx + -- [Sigma] cos ------ |  [f](x) cos ------ dx ... (2)
    l _/ 0            l         1      l   _/ 0              l

  We have thus seen, that with the assumptions made, the arbitrary
  function [f](x) may be represented, for the given interval, either by
  a series of sines, as in (1), or by a series of cosines, as in (2).
  Some important differences between the two series must, however, be
  noticed. In the first place, the series of sines has a vanishing sum
  when x=o or x=l; it therefore does not represent the function at the
  point x=o, unless [f](0) = 0, or at the point x=l, unless [f](l) = 0,
  whereas the series (2) of cosines may represent the function at both
  these points. Again, let us consider what is represented by (1) and
  (2) for values of x which do not lie between 0 and l. As [f](x) is
  given only for values of x between 0 and l, the series at points
  beyond these limits have no necessary connexion with [f](x) unless we
  suppose that [f](x) is also given for such general values of x in such
  a way that the series continue to represent that function. If in (1)
  we change x into -x, leaving the coefficients unaltered, the series
  changes sign, and if x be changed into x + 2l, the series is
  unaltered; we infer that the series (1) represents an odd function of
  x and is periodic of period 2l; thus (1) will represent [f](x) in
  general for values of x between [+-][oo], only if [f](x) is odd and
  has a period 2l. If in (2) we change x into -x, the series is
  unaltered, and it is also unaltered by changing x into x + 2l; from
  this we see that the series (2) represents [f](x) for values of x
  between [+-][oo], only if [f](x) is an even function, and is periodic
  of period 2l. In general a function [f](x) arbitrarily given for all
  values of x between [+-][oo] is neither periodic nor odd, nor even,
  and is therefore not represented by either (1) or (2) except for the
  interval 0 to l.

  From (1) and (2) we can deduce a series containing both sines and
  cosines, which will represent a function [f](x) arbitrarily given in
  the interval -l to l, for that interval. We can express by (1) the
  function -1/2{[f](x) - [f](-x)} which is an odd function, and thus this
  function is represented for the interval -l to +l by
                           _
    2              n[pi]x / l                           n[pi]x
    -- [Sigma] sin ------ |  1/2 {[f](x) - [f](-x)} sin ------ dx;
    l                 l  _/ 0                              l

  we can also express 1/2 {[f](x) + [f](-x)}, which is an even function,
  by means of (2), thus for the interval -l to +l this function is
  represented by
        _                                                     _
    1  / l                             2      [oo]    n[pi]x / l                            n[pi]x
    -- |   1/2 {[f](x) + [f](-x)} dx + -- [Sigma] cos ------ |   1/2 {[f](x) + [f](-x)} cos ------ dx.
    l _/ 0                             l         1       l  _/ 0                               l

  It must be observed that [f](-x) is absolutely independent of [f](x),
  the former being not necessarily deducible from the latter by putting
  -x for x in a formula; both [f](x) and [f](-x) are functions given
  arbitrarily and independently for the interval 0 to l. On adding the
  expressions together we obtain a series of sines and cosines which
  represents [f](x) for the interval -l to l. The integrals
      _                          _
     / l            n[pi]x      / l            n[pi]x
     |  [f](-x) cos ------ dx,  |  [f](-x) sin ------ dx
    _/ 0               l       _/ 0               l

  are equivalent to
       _                          _
      /-l          n[pi]x        /-l           n[pi]x
    - | [f](x) cos ------ dx,  + |  [f](x) sin ------ dx,
     _/0              l         _/ 0              l

  thus the series is
        _                                   _                                             _
    1  / l           1      [oo]    n[pi]x / l         n[pi]x      1      [oo]    n[pi]x / l           n[pi]x
    -- |  [f](x)dx + -- [Sigma] cos ------ |  f(x) cos ------ dx + -- [Sigma] sin ------ |  [f](x) sin ------ dx,
    2l_/-l           l         1       l  _/-l            l        l         1       l  _/-l              l

  which may be written
        _                            _
    1  / l              1      [oo] / l            n[pi](x - x')
    -- |  [f](x') dx' + -- [Sigma]  |  [f](x') cos ------------- dx'.  (3)
    2l_/-l              l        1 _/-l                  l

  The series (3), which represents a function [f](x) arbitrarily given
  for the interval -l to l, is what is known as Fourier's Series; the
  expressions (1) and (2) being regarded as the particular forms which
  (3) takes in the two cases, in which [f](-x) = -[f](x), or [f](-x) =
  f(x) respectively. The expression (3) does not represent f(x) at
  points beyond the interval -l to l, unless [f](x) has a period 2l. For
  a value of x within the interval, at which [f](x) is discontinuous,
  the sum of the series may cease to represent [f](x), but, as will be
  seen hereafter, has the value 1/2 {[f](x + 0) + [f](x - 0)}, the mean
  of the limits at the points on the right and the left. The series
  represents the function at x=o, unless the function is there
  discontinuous, in which case the series is 1/2 {[f](+0) + [f](-0)};
  the series does not necessarily represent the function at the points l
  and -l, unless [f](l) = [f](-l). Its sum at either of these points is
  1/2 {[f](l) + [f](-l)}.

  _Examples of Fourier's Series._--(a) Let [f](x) be given from 0 to l,
  by [f](x)=c, when 0 <= x < 1/2 l, and by f(x)= -c from 1/2 l to l; it
  is required to find a sine series, and also a cosine series, which
  shall represent the function in the interval.

  We have
      _                           _                     _
     / l           n[pi]x        /1/2 l  n[pi]x        / l    n[pi]x
     |  [f](x) sin ------ dx = c |   sin ------ dx - c |  sin ------ dx
    _/ 0              l         _/ 0        l         _/1/2 l    l

          cl
      = ----- (cos n[pi] - 2 cos 1/2 n[pi] + 1).
        n[pi]

  This vanishes if n is odd, and if n = 4m, but if n = 4m + 2 it is
  equal to 4cl/n[pi]; the series is therefore

     4c   /l      2[pi]x   1      6[pi]x   1      10[pi]x      \
    ---- ( -- sin ------ + -- sin ------ + -- sin ------- + ... ).
    [pi]  \2         l     3         l     5         l         /

  For unrestricted values of x, this series represents the ordinates of
  the series of straight lines in fig. 1, except that it vanishes at the
  points 0, (1/2)l, l, (3/2)l ...

  [Illustration: FIG. 1.]

  We find similarly that the same function is represented by the series

     4c   /    [pi]x   1      3[pi]x   1      5[pi]x        \
    ---- ( cos ----- - -- cos ------ + -- cos ------ - + ... )
    [pi]  \      l     3         l     5         l          /

  during the interval 0 to l; for general values of x the series
  represents the ordinate of the broken line in fig. 2, except that it
  vanishes at the points (1/2)l, (3/2)l....

  [Illustration: FIG. 2.]

  (b) Let [f](x) = x from 0 to 1/2 l, and f(x) = l - x, from 1/2 l to l;
  then
      _                       _                     _
     / l          n[pi]x     / 1/2 l   n[pi]x      / l           n[pi]x
     |  [f](x)sin ------ dx= |   x sin ------ dx + |  (l - x)sin ------ dx
    _/ 0             l      _/ 0          l       _/1/2 l           l

            l^2      n[pi]     l^2         n[pi]    l^2n  /   n[pi]            \
      = - ------ cos ----- + --------- sin ----- + ----- (cos ----- - cos n[pi] )
          2n[pi]       2     n^2[pi]^2       2     n[pi]  \     2              /

         l^2                l^2      n[pi]      l^2        n[pi]      2l^2       n[pi]
      + ----- cos n[pi] - ------ cos ----- + --------- sin ----- = --------- sin -----
        n[pi]             2n[pi]       2     n^2[pi]^2       2     n^2[pi]^2       2

  hence the sine series is

      4l    /   nx    1      3[pi]x    1      5[pi]x      \
    ------ (sin -- - --- sin ------ + --- sin ------ - ... )
    [pi]^2  \   l    3^2        l     5^2        l        /

  For general values of x, the series represents the ordinates of the
  row of broken lines in fig. 3.

  [Illustration: FIG. 3.]

  The cosine series, which represents the same function for the interval
  0 to l, may be found to be

    1        2l    /   2[pi]x    1      6[pi]x    1      10[pi]x      \
    -- l - ------ (cos ------ + --- cos ------ + --- cos ------- + ... )
    4      [pi]^2  \      l     3^2        l     5^2        l         /

  This series represents for general values of x the ordinate of the set
  of broken lines in fig. 4.

  [Illustration: FIG. 4.]

  _Dirichlet's Integral._--The method indicated by Fourier, but first
  carried out rigorously by Dirichlet, of proving that, with certain
  restrictions as to the nature of the function [f](x), that function is
  in general represented by the series (3), consists in finding the sum
  of n+1 terms of that series, and then investigating the limiting value
  of the sum, when n is increased indefinitely. It thus appears that the
  series is convergent, and that the value towards which its sum
  converges is 1/2 {[f](x + 0) + [f](x - 0)}, which is in general equal
  to [f](x). It will be convenient throughout to take -[pi] to [pi] as
  the given interval; any interval -l to l may be reduced to this by
  changing x into lx/[pi], and thus there is no loss of generality.

  We find by an elementary process that

    1/2 + cos (x - x') + cos 2(x - x') + ... + cos n(x - x')

          2n + 1
      sin ------ (x' - x)
             2
    = -------------------.
       2 sin 1/2(x' - x)

  Hence, with the new notation, the sum of the first n+1 terms of (3) is
          _
     1   / [pi]        sin (2n + 1)/2 (x' - x)
    ---- |     [f](x') ----------------------- dx'.
    [pi]_/-[pi]           2 sin 1/2 (x' - x)

  If we suppose [f](x) to be continued beyond the interval -[pi] to
  [pi], in such a way that [f](x) = [f](x + 2[pi]), we may replace the
  limits in this integral by x + [pi], x-[pi] respectively; if we then
  put x' - x = 2z, and let [f](x') = [F](z), the expression becomes
  1/[pi] [int][-[pi]/2 to [pi]/2] F(z) (sin mz/sin z) dz, where m = 2n +
  1; this expression may be written in the form
          _                            _
     1   /[pi]/2     sin mz        1  /[pi]/2      sin mz
    ---- |      F(z) ------ dz + ---- |      F(-z) ------ dz.  (4)
    [pi]_/ 0          sin z      [pi]_/ 0           sin z

  We require therefore to find the limiting value, when m is
  indefinitely increased, of [int][0 to [pi]/2] F(z)(sin mz/sin z) dz;
  the form of the second integral being essentially the same. This
  integral, or rather the slightly more general one [int][0 to h]
  F(z)(sin mz/sin z) dz, when 0 < h <= 1/2[pi], is known as Dirichlet's
  integral. If we write X(z)= F(z)(z/sin z), the integral becomes
  [int][0 to h] X(z)(sin mz/z) dz, which is the form in which the
  integral is frequently considered.

  _The Second Mean-Value Theorem._--The limiting value of Dirichlet's
  integral may be conveniently investigated by means of a theorem in the
  integral calculus known as the second mean-value theorem. Let a, b be
  two fixed finite numbers such that a<b, and suppose [f](x), [phi](x)
  are two functions which have finite and determinate values everywhere
  in the interval except for a finite number of points; suppose further
  that the functions [f](x), [phi](x) are integrable throughout the
  interval, and that as x increases from a to b the function [f](x) is
  monotone, i.e. either never diminishes or never increases; the theorem
  is that
      _                                  _                             _
     / b                                /[xi]                         / b
     |  [f](x) [phi](x) dx = [f](a + 0) |    [phi](x) dx + [f](b - 0) |   [phi](x) dx
    _/ a                               _/ a                          _/[xi]

  when [xi] is some point between a and b, and [f](a), [f](b) may be
  written for [f](a + 0), [f](b - 0) unless a or b is a point of
  discontinuity of the function [f](x).

  To prove this theorem, we observe that, since the product of two
  integrable functions is an integrable function, [int][a to b] [f](x)
  [phi](x) dx exists, and may be regarded as the limit of the sum of a
  series [f](x0) [phi](x0) (x1 - x0) + [f](x1) [phi](x1) (x2 - x1) + ...
  + [f]x(n-1) [phi]x_(n-1) (x_n - x_(n-1)) where x0 = a, x_n = b and x1,
  x2 ... x_(n-1) are n - 1 intermediate points. We can express
  [phi](x_r) (x_(r+1) - x_r) in the form Y_(r+1) - Y_r, by putting

               K=r
    Y_r = [Sigma] [phi](x_(K-1)) (x_K - x_(K-1)), Y0 = 0.
               K=1

  Writing X_r for [f](x_r), the series becomes

    X0(Y1 - Y0) + X1(Y2 - Y1) + ... + X_(n-1)(Y_n - Y_(n-1))

  or Y1(X0 - X1) + Y2(X1 - X2) + ... + Y_n(X_(n-1) - X_n) + Y_n X_n.

  Now, by supposition, all the numbers Y1, Y2 ... Y_n are finite, and
  all the numbers X_(r-1) - X_r are of the same sign, hence by a known
  algebraical theorem the series is equal to M(X0 - X_n) + Y_n X_n,
  where M is a number intermediate between the greatest and the least of
  the numbers Y1, Y2, ... Y_n. This remains true however many partial
  intervals are taken, and therefore, when their number is increased
  indefinitely, and their breadths are diminished indefinitely according
  to any law, we have
      _                                                   _
     / b                                      _          / b
     |  [f](x)[phi](x)dx = {[f](a) - [f](b)}  M + [f](b) |  [phi](x) dx
    _/ a                                                _/ a

  when M is intermediate between the greatest and least values which
  [int][a to x] [phi](x) dx can have, when x is in the given integral.
  Now this integral is a continuous function of its upper limit x, and
  therefore there is a value of x in the interval, for which it takes
  any particular value between the greatest and least values that it
  has. There is therefore a value [xi] between a and b, such that

         _
    _   /[xi]
    M = |    [phi](x)dx,
       _/ a

  hence
      _                                         _                        _
     / b                                       /[xi]                    / b
     |  [f](x) [phi](x) dx = {[f](a) - [f](b)} |   [phi](x) dx + [f](b) |  [phi](x) dx
    _/ a                                      _/ a                     _/ a
                _                         _
               /[xi]                     / b
      = [f](a) |    [phi](x) dx + [f](b) |    [phi](x) dx.
              _/ a                      _/[xi]

  If the interval contains any finite numbers of points of discontinuity
  of [f](x) or [phi](x), the method of proof still holds good, provided
  these points are avoided in making the subdivisions; in particular if
  either of the ends be a point of discontinuity of [f](x), we write
  [f](a + 0) or [f](b - 0), for [f](a) or [f](b), it being assumed that
  these limits exist.

  _Functions, with Limited Variation._--The condition that [f](x), in
  the mean-value theorem, either never increases or never diminishes as
  x increases from a to b, places a restriction upon the applications of
  the theorem. We can, however, show that a function [f](x) which is
  finite and continuous between a and b, except for a finite number of
  ordinary discontinuities, and which only changes from increasing to
  diminishing or vice versa, a finite number of times, as x increases
  from a to b, may be expressed as the difference of two functions
  [f]1(x), [f]2(x), neither of which ever diminishes as x passes from a
  to b, and that these functions are finite and continuous, except that
  one or both of them are discontinuous at the points where the given
  function is discontinuous. Let [alpha], [beta] be two consecutive
  points at which [f](x) is discontinuous, consider any point x1, such
  that [alpha] <= x1 <= [beta], and suppose that at the points M1, M2
  ... M_r between [alpha] and x1, [f](x) is a maximum, and at m1, m2 ...
  m_r, it is a minimum; we will suppose, for example, that the ascending
  order of values is [alpha], M1, m1, M2, m2 ... M_r, m_r, x1; it will
  make no essential difference in the argument if m1 comes before M1, or
  if M_r immediately precedes x1, M_(r-1) being then the last minimum.

  Let [psi](x1) = [[f](M1) - [f]([alpha] + 0)] + [[f](M2) - [f](m1)]+ ...
    +[[f](M_r) - [f](m_(r-1))] + [[f](x1) - [f](m_r)];

  now let (x1) increase until it reaches the value (M_(r+1)) at which
  [f](x) is again a maximum, then let

    [psi](x1) = [[f](M1) - [f]([alpha] + 0)] + [[f](M2) - [f](m1)] + ...
      + [[f](M_r) - [f](m_(r-1)] + [[f](M_(r+1)) - [f](m_r)];

  and suppose as x increases beyond the value M_(r+1), [psi](x1) remains
  constant until the next minimum m_(r+1) is reached, when it again
  becomes variable; we see that [psi](x1) is essentially positive and
  never diminishes as x increases.

  Let

    [chi](x1) = [[f](M1) - f(m1)] + [[f](M2) - [f](m1)] + ... + [[f](M_r)
      - [f](m_r)],

  then let x1 increase until it is beyond the next maximum M_(r+1), and
  then let

    [chi](x1) = [[f](M1) - [f](m1)] + [[f](M2) - [f](m1)] + ... +
      [[f](M_r) - [f](m_r)] + [[f](M_(r+1)) - [f](x1)]

  thus [chi](x1) never diminishes, and is alternately constant and
  variable. We see that [psi](x1) - [chi](x1) is continuous as x1
  increases from [alpha] to [beta], and that [psi](x1) - [chi](x1) =
  [f](x1) - [f]([alpha] + 0), and when x1 reaches [beta], we have
  [psi]([beta]) - [chi](x1) = [f]([beta] - 0) - [f]([alpha] + 0). Hence
  it is seen that between [alpha] and [beta], [f](x) = [[psi](x) +
  [f]([alpha] + 0)] - [chi](x), where [psi](x) + [f]([alpha] + 0),
  [chi](x) are continuous and never diminish as x increases; the same
  reasoning applies to every continuous portion of [f](x), for which
  the functions [psi](x), [chi](x) are formed in the same manner; we now
  take [f]1(x)=[psi](x) + [f]([alpha] + 0) + C, [f]2(x) = [chi](x) + C,
  where C is constant between consecutive discontinuities, but may have
  different values in the next interval between discontinuities; the C
  can be so chosen that neither [f]1(x) nor [f]2(x) diminishes as x
  increases through a value for which [f](x) is discontinuous. We thus
  see that [f](x) = [f]1(x) - [f]2(x), where [f]1(x), [f]2(x) never
  diminish as x increases from a to b, and are discontinuous only where
  [f](x) is so. The function [f](x) is a particular case of a class of
  functions defined and discussed by Jordan, under the name "functions
  with limited variation" (_fonctions a variation bornee_); in general
  such functions have not necessarily only a finite number of maxima and
  minima.

  _Proof of the Convergence of Fourier's Series._--It will now be
  assumed that a function [f](x) arbitrarily given between the values
  -[pi] and +[pi], has the following properties:--

  (a) The function is everywhere numerically less than some fixed
  positive number, and continuous except for a finite number of values
  of the variable, for which it may be ordinarily discontinuous.

  (b) The function only changes from increasing to diminishing or vice
  versa, a finite number of times within the interval; this is usually
  expressed by saying that the number of maxima and minima is finite.

  These limitations on the nature of the function are known as
  Dirichlet's conditions; it follows from them that the function is
  integrable throughout the interval.

  On these assumptions, we can investigate the limiting value of
  Dirichlet's integral; it will be necessary to consider only the case
  of a function F(z) which does not diminish as z increases from 0 to
  1/2[pi], since it has been shown that in the general case the
  difference of two such functions may be taken. The following lemmas
  will be required:

  1. Since
      _                   _
     /[pi]/2 sin mz      /[pi]/2                                              [pi]
     |       ------ dz = |      {1 + 2cos 2z + 2cos 4z + ... + 2cos 2nz} dz = ----;
    _/ 0      sin z     _/ 0                                                    2

  this result holds however large the odd integer m may be.

                                [pi]
  2. If 0 < [alpha] < [beta] <= ----,
                                  2
      _                               _                              _
     /[beta] sin mz           1      /[gamma]                1      /[beta]
     |       ------ dz = ----------- |       sin mz dz + ---------- |       sin mz dz
    _/[alpha] sin z      sin [alpha]_/[alpha]            sin [beta]_/[gamma]

  where [alpha] < [gamma] < [beta], hence
        _
    |  /[beta] sin mz    |   2   /     1           1    \          4
    |  |       ------ dz | < -- ( ---------- + --------- ) < -------------;
    | _/[alpha] sin z    |   m   \sin[alpha]   sin[beta]/    m sin [alpha]
                                           _
                                       |  / [beta] sin mz    |      4
  a precisely similar proof shows that |  |        ------ dz | < --------,
                                       | _/ [alpha]  z       |   m[alpha]
                        _                  _
                       /[beta] sin mz     /[beta] sin mz
  hence the integrals  |       ------ dz, |       ------ dz, converge to
                      _/[alpha] sin z    _/[alpha]   z

  the limit zero, as m is indefinitely increased.
                         _
                     |  / [oo]  sin [theta]          |
  3. If [alpha] > 0, |  |       ----------- d[theta] | cannot exceed
                     | _/[alpha]  [theta]            |

  1/2[pi]. For by the mean-value theorem
        _
    |  / h     sin[theta]          |      2      2
    |  |       ---------- d[theta] | < ------- + --,
    | _/[alpha]  [theta]           |   [alpha]   h
                     _
        |           / h      sin[theta]          |       2
  hence | Lh = [oo] |        ---------- d[theta] | <= -------;
        |          _/[alpha]   [theta]           |    [alpha]
                                       _
                                   |  /[oo]   sin[theta]          |     2     [pi]
  in particular if [alpha] >= [pi] |  |       ---------- d[theta] | <= ---- < ----.
                                   | _/[alpha]  [theta]           |    [pi]     2
                  _
            d    /[oo]    sin[theta]              sin[alpha]
  Again -------- |        ---------- d[theta] = - ----------, [alpha] > 0,
        d[alpha]_/[alpha]   [theta]                 [alpha]
             _
            /[oo]  sin[theta]
  therefore |      ---------- d[theta] increases as [alpha] diminishes,
           _/[alpha] [theta]

  when [theta] < [alpha] < [pi]; but lim
             _                                           _
            /[oo]  sin[theta]            [pi]        |  /[oo]  sin[theta]          |   [pi]
            |      ---------- d[theta] = ----, hence |  |      ---------- d[theta] | < ----,
  [alpha]=0_/[alpha] [theta]               2         | _/[alpha] [theta]           |    2

  where [alpha] < [pi], and < [pi]/2 where [alpha] >= [pi]. It follows that
        _
    |  /[beta] sin[theta]          |
    |  |       ---------- d[theta] | <= [pi], provided 0 <= [alpha] < [beta].
    | _/[alpha]  [theta]           |
                        _
                       /[pi]/2     sin mz
  To find the limit of |      F(z) ------ dz, we observe that it may be
                      _/ 0          sin z

  written in the form
          _                   _
         /[pi]/2 sin mz      / [mu]             sin mz
    F(0) |       ------ dz + |    {F(z) - F(0)} ------ dz
        _/        sin z     _/ 0                 sin z
         _
        /[pi]/2             sin mz
      + |     {F(z) - F(0)} ------ dz
       _/[mu]                sin z

  where [mu] is a fixed number as small as we please; hence if we use
  lemma (1), and apply the second mean-value theorem,
      _
     /[pi]/2    sin mz      [pi]
     |     F(z) ------ dz - ---- F(0)
    _/ 0         sin z        2
         _
        /[mu]                z   sin mz
      = |    {F(z) - F(0)} ----- ------ dz
       _/ [0]              sin z    z
                              _                                            _
                             /[xi]^1 sin mz                               /[pi]/2 sin mz
      + {F([mu] + 0) - F(0)} |       ------ dz + {F (1/2[pi] - 0) - F(0)} |       ------ dz
                            _/ [mu]   sin z                              _/[xi]^1  sin z

  when [xi]^1 lies between [mu] and 1/2[pi]. When m is indefinitely
  increased, the two last integrals have the limit zero in virtue of
  lemma (2). To evaluate the first integral on the right-hand side, let
  G/z = {F(z) - F(0)} (sin z/z), and observe that G(z) increases as z
  increases from 0 to [mu], hence if we apply the mean value theorem
        _                                  _
    |  /[mu]        sin mz   |   |        /[mu] sin mz   |
    |  |    G([mu]) ------ dz| = |G([mu]) |     ------ dz|
    | _/ 0             z     |   |       _/[xi]    z     |
                  _
        |        /m[mu] sin[theta]         |
      = |G([mu]) |      ---------- d[theta]| < [pi] G([mu]),
        |       _/m[xi]   [theta]          |

  where 0 < [xi] < [mu], since G(z) has the limit zero when z = 0. If
  [epsilon] be an arbitrarily chosen positive number, a fixed value of
  [mu] may be so chosen that [pi]G([mu)] < 1/2[epsilon], and thus that
        _
    |  /[mu]     sin mz   |
    |  |    G(z) ------ dz| < 1/2[epsilon].
    | _/0           z     |

  When [mu] has been so fixed, m may now be so chosen that
        _
    |  /1/2[pi]   sin mz      [pi]     |
    |  |     F(z) ------ dz - ---- F(0)| < [epsilon].
    | _/0          sin z       2       |

  It has now been shown that when m is indefinitely increased
      _
     /[pi]/2     sin mz      [pi]
     |      F(z) ------ dz - ---- F(0) has the limit zero.
    _/ 0          sin z        2

  Returning to the form (4), we now see that the limiting value of
          _                             _
      1  /[pi]/2     sin mz         1  /[pi]/2      sin mz
    ---- |      F(z) ------ dz  + ---- |      F(-z) ------ dz
    [pi]_/ 0          sin z       [pi]_/ 0           sin z

  1/2{F(+0) + F(-0)}; hence the sum of n + 1 terms of the series
         _                         _
    1   / l            1          / l            n[pi](x - x^1)
    --  |  [f](x) dx + -- [Sigma] |  [f](x^1) cos ------------- dx
    2l _/-l            l         _/-l                   l

  converges to the value 1/2 {[f](x + 0) + [f](x - 0)}, or to [f](x) at
  a point where [f](x) is continuous, provided [f](x) satisfies
  Dirichlet's conditions for the interval from -l to l.

  _Proof that Fourier's Series is in General Uniformly Convergent._--To
  prove that Fourier's Series converges uniformly to its sum for all
  values of x, provided that the immediate neighbourhoods of the points
  of discontinuity of [f](x) are excluded, we have
        _
    |  /[pi]/2   sin mz      [pi]     |                      4
    |  |     F(z)------ dz - ---- F(0)| < [pi]G ([mu]) + ---------- {F([mu] + 0) - F(0)}
    | _/          sin z        2      |                  m sin [mu]

             4
      + ------------ {F(1/2[pi] - 0) - F(0)}
        m sin [xi]^1

      [pi][mu]                                4
    < -------- {[f](x + 2[mu]) - [f](x)} + ---------- {[f](x + 2[mu]) - [f](x)}
      sin [mu]                             m sin [mu]

             4
      + ------------ {[f](x + [pi]) - [f](x)}
        m sin [xi]^1

  Using this inequality and the corresponding one for F(-z), we have

    |S_(2n+1)(x) - [f](x)| < [mu] cosec [mu] [|[f](x + 2[mu]) - [f](x)|
      + |[f](x - 2[mu]) - [f](x)|] + A|m cosec [mu],

  where A is some fixed number independent of m. In any interval (a, b)
  in which [f](x) is continuous, a value [mu]1 of [mu] can be chosen
  such that, for every value of x in (a, b), |[f](x + 2[mu]) - [f](x)|,
  |[f](x - 2[mu]) - [f](x)| are less than an arbitrarily prescribed
  positive number [epsilon], provided [mu] = [mu]1. Also a value [mu]2
  of [mu] can be so chosen that [epsilon][mu]2 cosec [mu]2 < 1/2[eta],
  where [eta] is an arbitrarily assigned positive number. Take for [mu]
  the lesser of the numbers [mu]1, [mu]2, then |S_(2n+1) - [f](x)| <
  [eta] + A|m cosec [mu] for every value of x in (a, b). It follows
  that, since [eta] and m are independent of x, |S_(2n+1) - [f](x)| <
  2[epsilon], provided n is greater than some fixed value n1 dependent
  only on [epsilon]. Therefore S_(2n+1) converges to [f](x) uniformly in
  the interval (a, b).

  _Case of a Function with Infinities._--The limitation that [f](x) must
  be numerically less than a fixed positive number throughout the
  interval may, under a certain restriction, be removed. Suppose F(z) is
  indefinitely great in the neighbourhood of the point z = c, and is

  such that the limits of the two integrals [int][c to c[+-][epsilon]]
  F(z) dz are both zero, as [epsilon] is indefinitely diminished, then

      _
     /[pi]/2     sin mz
     |      F(z) ------ dz
    _/ 0          sin z

  denotes the limit when [epsilon] = 0, [epsilon]^1 = 0 of
      _                          _
     /c-[epsilon]   sin mz      /[pi]/2           sin mz
     |         F(z) ------ dx + |            F(z) ------ dz,
    _/ 0             sin z     _/c+[epsilon]^1     sin z

  both these limits existing; the first of these integrals has
  1/2[pi]F(+0) for its limiting value when m is indefinitely increased,
  and the second has zero for its limit. The theorem therefore holds if
  F(z) has an infinity up to which it is absolutely integrable; this
  will, for example, be the case if F(z) near the point C is of the form
  x(z)(z - c)^-[mu] + [psi](z), where [chi](c), [psi](c) are finite, and
  0 < [mu] < 1. It is thus seen that [f](x) may have a finite number of
  infinities within the given interval, provided the function is
  integrable through any one of these points; the function is in that
  case still representable by Fourier's Series.

  _The Ultimate Values of the Coefficients in Fourier's Series._--If
  [f](x) is everywhere finite within the given interval -[pi] to +[pi],
  it can be shown that a_n, b_n, the coefficients of cos nx, sin nx in
  the series which represent the function, are such that na_n, nb_n,
  however great n is, are each less than a fixed finite quantity. For
  writing [f](x) = [f]1(x) - [f]2(x), we have
      _                                       _                             _
     /[pi]                                   /[xi]                         /[pi]
     |    [f]1(x) cos nxdx = [f]1(-[pi] + 0) |   cos nxdx + [f]1([pi] - 0) |   cos nxdx
    _/-[pi]                                 _/-[pi]                       _/[xi]

  hence
      _
     /[pi]                                   sin n[xi]                  sin n[xi]
     |    [f]1(x) cos nxdx = [f]1(-[pi] + 0) --------- + [f]1([pi] - 0) ---------
    _/-[pi]                                      n                          n

  with a similar expression, with [f]2(x) for [f]1(x), [xi] being
  between [pi] and -[pi]; the result then follows at once, and is
  obtained similarly for the other coefficient.

  If [f](x) is infinite at x = c, and is of the form [phi](x)/(x - c)^K
  near the point c, where 0 < K < 1, the integral
      _
     /[pi]
     |    [f](x)cos nxdx contains portions of the form
    _/-[pi]
      _                                       _
     /[epsilon]+[epsilon]  [phi](x)          / c           [phi](x)
     |                    --------- cos nxdx |            --------- cos nxdx;
    _/ [c]                (x - c)^K         _/c-[epsilon] (x - c)^K

  consider the first of these, and put x = c + u, it thus becomes
      _
     /[epsilon] [phi](c + u)
     |          ------------ cos n(c + u) du, which is of the form
    _/  0            u^K
                                 _
                                /[epsilon] cos n(c + u)
    [phi](c + [theta][epsilon]) |          ------------ du;
                               _/  0           u^K

  now let nu = v, the integral becomes
                                 _           _                                _                  _
                                |  cos nc   /n[epsilon]  cos v      sin nc   /n[epsilon] sin v    |
    [phi](c + [theta][epsilon]) |  -------  |            ----- dv - -------  |           ----- dv |;
                                |_ n^(1-K) _/ 0           v^K       n^(1-K) _/ 0          v^K    _|

  hence n^(1-K) [int]([pi] to -[pi]) [f](x) cos nxdx becomes, as n is
  definitely increased, of the form
              _        _                       _            _
             |        /[oo] cos v             /[oo] sin v    |
    [phi](c) | cos nc |     ----- dv - sin nc |     ----- dv |
             |_      _/ 0    v^K             _/ 0    v^K    _|

  which is finite, both the integrals being convergent and of known
  value. The other integral has a similar property, and we infer that
  n^(1-K) a_n, n^(1-K) b_n are less than fixed finite numbers.

  _The Differentiation of Fourier's Series._--If we assume that the
  differential coefficient of a function [f](x) represented by a
  Fourier's Series exists, that function [f]'(x) is not necessarily
  representable by the series obtained by differentiating the terms of
  the Fourier's Series, such derived series being in fact not
  necessarily convergent. Stokes has obtained general formulae for
  finding the series which represent f'(x), [f]"(x)--the successive
  differential coefficients of a limited function [f](x). As an example
  of such formulae, consider the sine series (1); [f](x) is represented
  by
                           _
    2              n[pi]x /l            n[pi]x
    -- [Sigma] sin ------ |  [f](x) sin ------ dx;
    l                 l  _/0               l
                                   _
                                  /l          n[pi]x
  on integration by parts we have | [f](x)sin ------ dx
                                 _/0             l
             _                                                                                  _
        l   |                                       n[pi]a                                       |
    = ----  | [f](+0) [+-] [f](l - 0) + [Sigma] cos ------ {[f]([alpha] + 0) - [f]([alpha] - 0)} |
      n[pi] |_                                         l                                        _|
                _
          l    /l             n[pi]x
      + -----  |  [f]'(x) cos ------ dx
        n[pi] _/0                l

  where [alpha] represent the points where [f](x) is discontinuous.
  Hence if f(x) is represented by the series [Sigma]a_n sin (n[pi]x/l),
  and [f]'(x) by the series [Sigma]b_n cos (n[pi]x/l), we have the
  relation
                                _                                                                                     _
          n[pi]             2  |                                      n[pi][alpha]                                     |
    b_n = ----- [alpha]_n - -- | [f](+0) [+-] [f](l - 0) + [Sigma]cos ------------ {[f]([alpha] + 0) - [f](alpha - 0)} |
            l               l  |_                                           l                                         _|

  hence only when the function is everywhere continuous, and [f](+0)
  [f](l - 0) are both zero, is the series which represents [f]'(x)
  obtained at once by differentiating that which represents [f](x). The
  form of the coefficient [alpha]_n discloses the discontinuities of the
  function and of its differential coefficients, for on continuing the
  integration by parts we find
                       _                                                                                        _
                  2   |                                       n[pi][alpha]                                       |
    [alpha]_n = ----- | [f](+0) [+-] [f](l - 0) + [Sigma] cos ------------ {[f]([alpha] + 0) - [f]([alpha] - 0)} |
                n[pi] |_                                           l                                            _|
                    _                                                                                         _
            2l     |                                         n[pi][beta]                                       |
      + ---------  | [f]'(+0) [+-] [f]'(l - 0) + [Sigma] sin ----------- {[f]'([beta] + 0) - [f]'([beta] - 0)} | + &c.
        n^2[pi]^2  |_                                             l                                           _|

  where [beta] are the points at which [f]'(x) is discontinuous.


  HISTORY AND LITERATURE OF THE THEORY

  The history of the theory of the representation of functions by series
  of sines and cosines is of great interest in connexion with the
  progressive development of the notion of an arbitrary function of a
  real variable, and of the peculiarities which such a function may
  possess; the modern views on the foundations of the infinitesimal
  calculus have been to a very considerable extent formed in this
  connexion (see FUNCTION). The representation of functions by these
  series was first considered in the 18th century, in connexion with the
  problem of a vibrating cord, and led to a controversy as to the
  possibility of such expansions. In a memoir published in 1747
  (_Memoirs of the Academy of Berlin_, vol. iii.) D'Alembert showed that
  the ordinate y at any time t of a vibrating cord satisfies a
  differential equation of the form [delta]^y/[delta]t^2 = a^2
  [delta]^y/[delta]x^2, where x is measured along the undisturbed length
  of the cord, and that with the ends of the cord of length l fixed, the
  appropriate solution is y = [f](at + x) - [f](at - x), where [f] is a
  function such that [f](x) = [f](x + 2l); in another memoir in the same
  volume he seeks for functions which satisfy this condition. In the
  year 1748 (_Berlin Memoirs_, vol. iv.) Euler, in discussing the
  problem, gave [f](x) = [alpha] sin [pi]x/l + [beta] sin 2[pi]x/l + ...
  as a particular solution, and maintained that every curve, whether
  regular or irregular, must be representable in this form. This was
  objected to by D'Alembert (1750) and also by Lagrange on the ground
  that irregular curves are inadmissible. D. Bernoulli (_Berlin
  Memoirs_, vol. ix., 1753) based a similar result to that of Euler on
  physical intuition; his method was criticized by Euler (1753). The
  question was then considered from a new point of view by Lagrange, in
  a memoir on the nature and propagation of sound (_Miscellanea
  Taurensia_, 1759; [_OE]uvres_, vol. i.), who, while criticizing
  Euler's method, considers a finite number of vibrating particles, and
  then makes the number of them infinite; he did not, however, quite
  fully carry out the determination of the coefficients in Bernoulli's
  Series. These mathematicians were hampered by the narrow conception of
  a function, in which it is regarded as necessarily continuous; a
  discontinuous function was considered only as a succession of several
  different functions. Thus the possibility of the expansion of a broken
  function was not generally admitted. The first cases in which rational
  functions are expressed in sines and cosines were given by Euler
  (_Subsidium calculi sinuum_, Novi Comm. Petrop., vol. v., 1754-1755),
  who obtained the formulae

    1/2 [phi] = sin [phi] - 1/2 sin 2[phi] + 1/3 sin 3[phi] ...

    [pi]^2   [phi]^2
    ------ - ------- = cos [phi] - 1/4 cos 2[phi] + 1/9 cos 3[phi] ...
      12        4

  In a memoir presented to the Academy of St Petersburg in 1777, but not
  published until 1798, Euler gave the method afterwards used by
  Fourier, of determining the coefficients in the expansions; he
  remarked that if [Phi] is expansible in the form
                                                         _                           _
                                                   1    /[pi]                  2    /[pi]
    A + B cos[phi] + C cos 2[phi] + ..., then A = ----  |    [Phi]d[phi], B = ----  |   cos [phi]d[phi], &c.
                                                  [pi] _/ 0                   [pi] _/ 0

  The second period in the development of the theory commenced in 1807,
  when Fourier communicated his first memoir on the Theory of Heat to
  the French Academy. His exposition of the present theory is contained
  in a memoir sent to the Academy in 1811, of which his great treatise
  the _Theorie analytique de la chaleur_, published in 1822, is, in the
  main, a reproduction. Fourier set himself to consider the
  representation of a function given graphically, and was the first
  fully to grasp the idea that a single function may consist of detached
  portions given arbitrarily by a graph. He had an accurate conception
  of the convergence of a series, and although he did not give a
  formally complete proof that a function with discontinuities is
  representable by the series, he indicated in particular cases the
  method of procedure afterwards carried out by Dirichlet. As an
  exposition of principles, Fourier's work is still worthy of careful
  perusal by all students of the subject. Poisson's treatment of the
  subject, which has been adopted in English works (see the _Journal de
  l'ecole polytechnique_, vol. xi., 1820, and vol. xii., 1823, and also
  his treatise, _Theorie de la chaleur_, 1835), depends upon the equality
      _
     /[pi]                         1 - h^2
     |    [f]([alpha]) ------------------------------ d[alpha]
    _/-[pi]            1 - 2h cos (x - [alpha]) + h^2

                _                                            _
          1    /[pi]                          1             /[pi]
      = -----  |    [f]([alpha]) d[alpha] + ---- [Sigma]h^n |     [f]([alpha]) cos n(x - [alpha]) d[alpha]
        2[pi] _/-[pi]                       [pi]           _/-[pi]

  where 0 < h < 1; the limit of the integral on the left-hand side is
  evaluated when h=1, and found to be 1/2 {[f](x + 0) + [f](x - 0)}, the
  series on the right-hand side becoming Fourier's Series. The equality
  of the two limits is then inferred. If the series is assumed to be
  convergent when h = 1, by a theorem of Abel's its sum is continuous
  with the sum for values of h less than unity, but a proof of the
  convergency for h = 1 is requisite for the validity of Poisson's
  proof; as Poisson gave no such proof of convergency, his proof of the
  general theorem cannot be accepted. The deficiency cannot be removed
  except by a process of the same nature as that afterwards applied by
  Dirichlet. The definite integral has been carefully studied by Schwarz
  (see two memoirs in his collected works on the integration of the
  equation [delta]^2u/[delta]x^2 + [delta]^2u/[delta]y^2 = 0), who showed
  that the limiting value of the integral depends upon the manner in
  which the limit is approached. Investigations of Fourier's Series were
  also given by Cauchy (see his "Memoire sur les developpements des
  fonctions en series periodiques," _Mem. de l'Inst_., vol. vi., also
  _Oeuvres completes_, vol. vii.); his method, which depends upon a use
  of complex variables, was accepted, with some modification, as valid
  by Riemann, but one at least of his proofs is no longer regarded as
  satisfactory. The first completely satisfactory investigation is due
  to Dirichlet; his first memoir appeared in _Crelle's Journal_ for
  1829, and the second, which is a model of clearness, in Dove's
  _Repertorium der Physik_. Dirichlet laid down certain definite
  sufficient conditions in regard to the nature of a function which is
  expansible, and found under these conditions the limiting value of the
  sum of n terms of the series. Dirichlet's determination of the sum of
  the series at a point of discontinuity has been criticized by Schlafli
  (see _Crelle's Journal_, vol. lxxii.) and by Du Bois-Reymond (_Mathem.
  Annalen_, vol. vii.), who maintained that the sum is really
  indeterminate. Their objection appears, however, to rest upon a
  misapprehension as to the meaning of the sum of the series; if x1 be
  the point of discontinuity, it is possible to make x approach x1,
  and n become indefinitely great, so that the sum of the series takes
  any assigned value in a certain interval, whereas we ought to make x =
  x1 first and afterwards n = [oo], and no other way of going to the
  double limit is really admissible. Other papers by Dircksen (_Crelle_,
  vol. iv.) and Bessel (_Astronomische Nachrichten_, vol. xvi.), on
  similar lines to those by Dirichlet, are of inferior importance. Many
  of the investigations subsequent to Dirichlet's have the object of
  freeing a function from some of the restrictions which were imposed
  upon it in Dirichlet's proof, but no complete set of necessary and
  sufficient conditions as to the nature of the function has been
  obtained. Lipschitz ("De explicatione per series trigonometricas,"
  _Crelle's Journal_, vol. lxiii., 1864) showed that, under a certain
  condition, a function which has an infinite number of maxima and
  minima in the neighbourhood of a point is still expansible; his
  condition is that at the point of discontinuity [beta], |[f]([beta] +
  [delta]) -f([beta])| < B[delta]^[alpha] as [delta] converges to zero,
  B being a constant, and a a positive exponent. A somewhat wider
  condition is

    {[f]([beta] + [delta]) - [f]([beta])} log [delta]) = 0,
                                      [delta] = 0

  for which Lipschitz's results would hold. This last condition is
  adopted by Dini in his treatise (_Sopra la serie di Fourier_, &c.,
  Pisa, 1880).

  The modern period in the theory was inaugurated by the publication by
  Riemann in 1867 of his very important memoir, written in 1854, _Uber
  die Darstellbarkeit einer Function durch eine trigonometrische Reihe_.
  The first part of his memoir contains a historical account of the work
  of previous investigators; in the second part there is a discussion of
  the foundations of the Integral Calculus, and the third part is mainly
  devoted to a discussion of what can be inferred as to the nature of a
  function respecting the changes in its value for a continuous change
  in the variable, if the function is capable of representation by a
  trigonometrical series. Dirichlet and probably Riemann thought that
  all continuous functions were everywhere representable by the series;
  this view was refuted by Du Bois-Reymond (_Abh. der Bayer. Akad._ vol.
  xii. 2). It was shown by Riemann that the convergence or
  non-convergence of the series at a particular point x depends only
  upon the nature of the function in an arbitrarily small neighbourhood
  of the point x. The first to call attention to the importance of the
  theory of uniform convergence of series in connexion with Fourier's
  Series was Stokes, in his memoir "On the Critical Values of the Sums
  of Periodic Series" (_Camb. Phil. Trans._, 1847; _Collected Papers_,
  vol. i.). As the method of determining the coefficients in a
  trigonometrical series is invalid unless the series converges in
  general uniformly, the question arose whether series with coefficients
  other than those of Fourier exist which represent arbitrary functions.
  Heine showed (_Crelle's Journal_, vol. lxxi., 1870, and in his
  treatise _Kugelfunctionen_, vol. i.) that Fourier's Series is in
  general uniformly convergent, and that if there is a uniformly
  convergent series which represents a function, it is the only one of
  the kind. G. Cantor then showed (_Crelle's Journal_, vols. lxxii.
  lxxiii.) that even if uniform convergence be not demanded, there can
  be but one convergent expansion for a function, and that it is that of
  Fourier. In the _Math. Ann._ vol. v., Cantor extended his
  investigation to functions having an infinite number of
  discontinuities. Important contributions to the theory of the series
  have been published by Du Bois-Reymond (_Abh. der Bayer. Akademie_,
  vol. xii., 1875, two memoirs, also in Crelle's Journal, vols. lxxiv.
  lxxvi. lxxix.), by Kronecker (_Berliner Berichte_, 1885), by O. Holder
  (_Berliner Berichte_, 1885), by Jordan (_Comptes rendus_, 1881, vol.
  xcii.), by Ascoli (_Math. Annal._, 1873, and _Annali di matematica_,
  vol. vi.), and by Genocchi (_Atti della R. Acc. di Torino_, vol. x.,
  1875). Hamilton's memoir on "Fluctuating Functions" (_Trans. R.I.A._,
  vol. xix., 1842) may also be studied with profit in this connexion. A
  memoir by Broden (_Math. Annalen_, vol. lii.) contains a good
  investigation of some of the most recent results on the subject. The
  scope of Fourier's Series has been extended by Lebesgue, who
  introduced a conception of integration wider than that due to Riemann.
  Lebesgue's work on Fourier's Series will be found in his treatise,
  _Lecons sur les series trigonometriques_ (1906); also in a memoir,
  "Sur les series trigonometriques," _Annales sc. de l'ecole normale
  superieure_, series ii. vol. xx. (1903), and in a paper "Sur la
  convergence des series de Fourier," _Math. Annalen_, vol. lxiv.
  (1905).

  AUTHORITIES.--The foregoing historical account has been mainly drawn
  from A. Sachse's work, "Versuch einer Geschichte der Darstellung
  willkurlicher Functionen einer Variabeln durch trigonometrische
  Reihen," published in _Schlomilch's Zeitschrift fur Mathematik_,
  Supp., vol. xxv. 1880, and from a paper by G.A. Gibson "On the History
  of the Fourier Series" (_Proc. Ed. Math. Soc._ vol. xi.). Reiff's
  _Geschichte der unendlichen Reihen_ may also be consulted, and also
  the first part of Riemann's memoir referred to above. Besides Dini's
  treatise already referred to, there is a lucid treatment of the
  subject from an elementary point of view in C. Neumann's treatise,
  _Uber die nach Kreis-, Kugel- und Cylinder-Functionen fortschreitenden
  Entwickelungen_. Jordan's discussion of the subject in his _Cours
  d'analyse_ is worthy of attention: an account of functions with
  limited variation is given in vol. i.; see also a paper by Study in
  the _Math. Annalen_, vol. xlvii. On the second mean-value theorem
  papers by Bonnet (Brux. Memoires, vol. xxiii., 1849, _Lionville's
  Journal_, vol. xiv., 1849), by Du Bois-Reymond (_Crelle's Journal_,
  vol. lxxix., 1875), by Hankel (_Zeitschrift fur Math. und Physik_,
  vol. xiv., 1869), by Meyer (_Math. Ann._, vol. vi., 1872) and by
  Holder (_Gottinger Anzeigen_, 1894) may be consulted; the most general
  form of the theorem has been given by Hobson (_Proc. London Math.
  Soc._, Series II. vol. vii., 1909). On the theory of uniform
  convergence of series, a memoir by W.F. Osgood (_Amer. Journal of
  Math._ xix.) may be with advantage consulted. On the theory of series
  in general, in relation to the functions which they can represent, a
  memoir by Baire (_Annali di matematica_, Series III. vol. iii.) is of
  great importance. Bromwich's _Theory of Infinite Series_ (1908)
  contains much information on the general theory of series. Bocher's
  "Introduction to the Theory of Fourier's Series," _Annals of Math._,
  Series II. vol. vii., 1906, will be found useful. See also Carslaw's
  _Introduction to the Theory of Fourier's Series and Integrals, and the
  Mathematical Theory of the Conduction of Heat_ (1906). A full account
  of the theory will be found in Hobson's treatise _On the Theory of
  Functions of a Real Variable and on the Theory of Fourier's Series_
  (1907).     (E. W. H.)

## See also

- [[Kalinjar]]

## References

- <https://en.wikisource.org/wiki/1911_Encyclopædia_Britannica/Fourier'S_Series>

#literature #science
