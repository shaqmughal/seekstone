---
title: "Differences"
date_created: 2023-10-08
topic: history
source: "https://en.wikisource.org/wiki/1911_Encyclopædia_Britannica/Differences"
---

# Differences

DIFFERENCES, CALCULUS OF (_Theory of Finite Differences_), that branch
of mathematics which deals with the successive differences of the terms
of a series.

1. The most important of the cases to which mathematical methods can be
applied are those in which the terms of the series are the values, taken
at stated intervals (regular or irregular), of a continuously varying
quantity. In these cases the formulae of finite differences enable
certain quantities, whose exact value depends on the law of variation
(i.e. the law which governs the relative magnitude of these terms) to be
calculated, often with great accuracy, from the given terms of the
series, without explicit reference to the law of variation itself. The
methods used may be extended to cases where the series is a double
series (series of double entry), i.e. where the value of each term
depends on the values of a pair of other quantities.

2. The _first differences_ of a series are obtained by subtracting from
each term the term immediately preceding it. If these are treated as
terms of a new series, the first differences of this series are the
_second differences_ of the original series; and so on. The successive
differences are also called _differences of the first, second, ...
order_. The differences of successive orders are most conveniently
arranged in successive columns of a table thus:--

  +-----+----------+-----------+-----------------+----------------------+
  |Term.| 1st Diff.| 2nd Diff. |    3rd Diff.    |      4th Diff.       |
  +-----+----------+-----------+-----------------+----------------------+
  |     |          |           |                 |                      |
  |  a  |          |           |                 |                      |
  |     |   b - a  |           |                 |                      |
  |  b  |          | c - 2b +a |                 |                      |
  |     |   c - b  |           | d - 3c + 3b - a |                      |
  |  c  |          | d - 2c +b |                 | e - 4d + 6c - 4b + a |
  |     |   d - c  |           | e - 3d + 3c - b |                      |
  |  d  |          | e - 2d +c |                 |                      |
  |     |   e - d  |           |                 |                      |
  |  e  |          |           |                 |                      |
  +-----+----------+-----------+-----------------+----------------------+

    _Algebra of Differences and Sums._

  [Illustration: FIG. 1.]

  3. The formal relations between the terms of the series and the
  differences may be seen by comparing the arrangements (A) and (B) in
  fig. 1. In (A) the various terms and differences are the same as in §
  2, but placed differently. In (B) we take a new series of terms
  [alpha], [beta], [gamma], [delta], commencing with the same term
  [alpha], and take the successive sums of pairs of terms, instead of
  the successive differences, but place them to the left instead of to
  the right. It will be seen, in the first place, that the successive
  terms in (A), reading downwards to the right, and the successive terms
  in (B), reading downwards to the left, consist each of a series of
  terms whose coefficients follow the binomial law; i.e. the
  coefficients in b - a, c - 2b + a, d - 3c + 3b - a, ... and in [alpha]
  + [beta], [alpha] + 2[beta] + [gamma], [alpha] + 3[beta] + 3[gamma] +
  [delta], ... are respectively the same as in y - x, (y - x)², (y -
  x)³, ... and in x + y, (x + y)², (x + y)³,.... In the second place, it
  will be seen that the relations between the various terms in (A) are
  identical with the relations between the similarly placed terms in
  (B); e.g. [beta] + [gamma] is the difference of [alpha] + 2[beta] +
  [gamma] and [alpha] + [beta], just as c - b is the difference of c and
  b: and d - c is the sum of c - b and d - 2c + b, just as [beta] +
  2[gamma] + [delta] is the sum of [beta] + [gamma] and [gamma] +
  [delta]. Hence if we take [beta], [gamma], [delta], ... of (B) as
  being the same as b - a, c - 2b + a, d -3c + 3b - a, ... of (A), all
  corresponding terms in the two diagrams will be the same.

  Thus we obtain the two principal formulae connecting terms and
  differences. If we provisionally describe b - a, c - 2b + a, ... as
  the first, second, ... differences of the particular term a (§ 7),
  then (i.) the nth difference of a is

                              n·n - 1
    l - nk + ... + (-1)^(n-2) ------- c + (-1)^(n-1) nb + (-1)^n a,
                                1·2

  where l, k ... are the (n + 1)th, nth, ... terms of the series a, b,
  c, ...; the coefficients being those of the terms in the expansion of
  (y -x)^n: and (ii.) the (n + 1)th term of the series, i.e. the nth
  term after a, is

                  n·n - 1
    a + n[beta] + ------- [gamma] + ...
                    1·2

  where [beta], [gamma], ... are the first, second, ... differences of
  a; the coefficients being those of the terms in the expansion of (x +
  y)^n.

  4. Now suppose we treat the terms a, b, c, ... as being themselves the
  first differences of another series. Then, if the first term of this
  series is N, the subsequent terms are N + a, N + a + b, N + a + b + c,
  ...; i.e. the difference between the (n + 1)th term and the first term
  is the sum of the first n terms of the original series. The term N, in
  the diagram (A), will come above and to the left of a; and we see, by
  (ii.) of § 3, that the sum of the first n terms of the original series
  is

     /         n·n - 1            \             n·n - 1          n·n - 1·n - 2
    ( N + na + ------- [beta] + ...) - N = na + ------- [beta] + ------------- [gamma] + ...
     \           1·2              /               1·2              1 · 2 · 3

  5. As an example, take the arithmetical series

    a, a + p, a + 2p, ...

  The first differences are p, p, p, ... and the differences of any
  higher order are zero. Hence, by (ii.) of § 3, the (n + 1)th term is a
  + np, and, by § 4, the sum of the first n terms is na + ½n(n - 1)p =
  ½n{2a + (n - 1)p}.

  6 As another example, take the series 1, 8, 27, ... the terms of which
  are the cubes of 1, 2, 3, ... The first, second and third differences
  of the first term are 7, 12 and 6, and it may be shown (§ 14 (i.))
  that all differences of a higher order are zero. Hence the sum of the
  first n terms is

          n·n - 1      n·n - 1·n - 2     n·n - 1·n - 2·n - 3
    n + 7 ------- + 12 ------------- + 6 ------------------- =
            1·2            1·2·3              1·2·3·4

      ¼n^4 + ½n³ + ¼n² = {½n(n + 1)}².

  7. In § 3 we have described b - a, c - 2b + a, ... as the first,
  second, ... differences of a. This ascription of the differences to
  particular terms of the series is quite arbitrary. If we read the
  differences in the table of § 2 upwards to the right instead of
  downwards to the right, we might describe e - d, e - 2d + c, ... as
  the first, second, ... differences of e. On the other hand, the term
  of greatest weight in c -2b + a, i.e. the term which has the
  numerically greatest coefficient, is b, and therefore c - 2b + a might
  properly be regarded as the second difference of b, and similarly e -
  4d + 6c - 4b + a might be regarded as the fourth difference of c.
  These three methods of regarding the differences lead to three
  different systems of notation, which are described in §§ 9, 10 and 11.


  _Notation of Differences and Sums._

  8. It is convenient to denote the terms a, b, c, ... of the series by
  u0, u1, u2, u3, ... If we merely have the terms of the series, un may
  be regarded as meaning the (n + 1)th term. Usually, however, the terms
  are the values of a quantity u, which is a function of another
  quantity x, and the values of x, to which a, b, c, ... correspond,
  proceed by a constant difference h. If x0 and u0 are a pair of
  corresponding values of x and u, and if any other value x0 + mh of x
  and the corresponding value of u are denoted by xm and um, then the
  terms of the series will be ... u_(n-2), u_(n-1), u_n, u_(n+1),
  u_(n+2) ..., corresponding to values Of x denoted by ... x_(n-2),
  x_(n-1), x_n, x_(n+1), x_(n+2)....

  9. In the _advancing-difference notation_ u_(n+1) - u_n is denoted by
  [Delta]un. The differences [Delta]u0, [Delta]u1, [Delta]u2 ... may
  then be regarded as values of a function [Delta]u corresponding to
  values of x proceeding by constant difference h; and therefore
  [Delta]u_(n+1) -[Delta]u_n denoted by [Delta][Delta]u_n, or, more
  briefly, [Delta]²u_n; and so on. Hence the table of differences in §
  2, with the corresponding values of x and of u placed opposite each
  other in the ordinary manner of mathematical tables, becomes

    +---------+---------+----------------+-----------------+-----------------+----------------------+
    |    x    |    u    |    1st Diff.   |    2nd Diff.    |     3rd Diff.   |       4th Diff.      |
    +---------+---------+----------------+-----------------+-----------------+----------------------+
    |    .    |    .    |        .       |        .        |        .        |          .           |
    |    .    |    .    |        .       |        .        |        .        |          .           |
    |    .    |    .    |        .       |        .        |        .        |          .           |
    |         |         |                |                 |                 |                      |
    | x_(n-2) | u_(n-2) |                | [Delta]²u_(n-3) |                 | [Delta]^4u_(n-4) ... |
    |         |         | [Delta]u_(n-2) |                 | [Delta]³u_(n-3) |                      |
    | x_(n-1) | u_(n-1) |                | [Delta]²u_(n-2) |                 | [Delta]^4u_(n-3) ... |
    |         |         | [Delta]u_(n-1) |                 | [Delta]³u_(n-2) |                      |
    | xn      | u_n     |                | [Delta]²u_(n-1) |                 | [Delta]^4u_(n-2) ... |
    |         |         | [Delta]u_n     |                 | [Delta]³u_(n-1) |                      |
    | x_(n+1) | u_(n+1) |                | [Delta]²u_n     |                 | [Delta]^4u_(n-1) ... |
    |         |         | [Delta]u_(n+1) |                 | [Delta]³u_n     |                      |
    | x_(n+2) | u_(n+2) |                | [Delta]²u_(n+1) |                 | [Delta]^4u_n     ... |
    |    .    |    .    |        .       |        .        |        .        |          .           |
    |    .    |    .    |        .       |        .        |        .        |          .           |
    |    .    |    .    |        .       |        .        |        .        |          .           |
    +---------+---------+----------------+-----------------+-----------------+----------------------+

  The terms of the series of which ... u_(n-1), u_n, u_(n+1), ... are
  the first differences are denoted by [Sigma]u, with proper suffixes,
  so that this series is ... [Sigma]u_(n-1), [Sigma]u_n,
  [Sigma]u_(n+1).... The suffixes are chosen so that we may have
  [Delta][Sigma]un = un, whatever n may be; and therefore (§ 4)
  [Sigma]un may be regarded as being the sum of the terms of the series
  up to and including un-1. Thus if we write [Sigma]u_(n-1) = C + un-2,
  where C is any constant, we shall have

    [Sigma]u_n = [Sigma]u_(n-1) + [Delta][Sigma]u_(n-1) = C + u_(n-2) + u_(n-1),
    [Sigma]u_(n+1) = C + u_(n-2) + u_(n-1) + u_n,

  and so on. This is true whatever C may be, so that the knowledge of
  ... u_n-1, u_n, ... gives us no knowledge of the exact value of
  [Sigma]u_n; in other words, C is an arbitrary constant, the value of
  which must be supposed to be the same throughout any operations in
  which we are concerned with values of [Sigma]_u corresponding to
  different suffixes.

  There is another symbol E, used in conjunction with u to denote the
  next term in the series. Thus Eun means u_(n+1), so that Eun = u_n +
  [Delta]u_n.

  10. Corresponding to the advancing-difference notation there is a
  _receding-difference_ notation, in which u_(n+1) - u_n is regarded as
  a difference of u_(n+1), and may be denoted by [Delta]'u_(n+1), and
  similarly u_(n+1) - 2u_n + u_(n-1) may be denoted by [Delta]'²u_(n+1).
  This notation is only required for certain special purposes, and the
  usage is not settled (§ 19 (ii.)).

  11. The _central-difference_ notation depends on treating u_(n+1) -
  2u_n -u_(n-1) as the second difference of un, and therefore as
  corresponding to the value x_n; but there is no settled system of
  notation. The following seems to be the most convenient. Since un is a
  function of x_n, and the second difference u_(n+2) - 2u_(n+1) + u_n is
  a function of x_(n+1), the first difference u_(n+1) - u_n must be
  regarded as a function of x_(n+½), i.e. of ½{x_n + x_(n+1)}. We
  therefore write u_(n+1) - u_n = [delta]u_(n+½), and each difference in
  the table in § 9 will have the same suffix as the value of x in the
  same horizontal line; or, if the difference is of an odd order, its
  suffix will be the means of those of the two nearest values of x. This
  is shown in the table below.

  In this notation, instead of using the symbol E, we use a symbol [mu]
  to denote the mean of two consecutive values of u, or of two
  consecutive differences of the same order, the suffixes being assigned
  on the same principle as in the case of the differences. Thus

    [mu]u_(n+½) = ½{u_n + u_(n+1)}, [mu][delta]u_n = ½{[delta]u_(n-½)} + [delta]u_(n+½), &c.

  If we take the means of the differences of odd order immediately above
  and below the horizontal line through any value of x, these means,
  with the differences of even order in that line, constitute the
  _central differences_ of the corresponding value of u. Thus the table
  of central differences is as follows, the values obtained as means
  being placed in brackets to distinguish them from the actual
  differences:--

    +-------+-------+---------------------+----------------+----------------------+----------------------+
    |   x   |   u   |      1st Diff.      |    2nd Diff.   |       3rd Diff.      |      4th Diff.       |
    +-------+-------+---------------------+----------------+----------------------+----------------------+
    |   .   |   .   |          .          |        .       |           .          |           .          |
    |   .   |   .   |          .          |        .       |           .          |           .          |
    |   .   |   .   |          .          |        .       |           .          |           .          |
    |x_(n-2)|u_(n-2)| {[mu][delta]u_(n-2)}| [delta]²u_(n-2)| {[mu][delta]³u_(n-2)}| [delta]^4u_(n-2) ... |
    |       |       |   [delta]u_(n-3/2)  |                |  [delta]³u_(n-3/2)   |                      |
    |x_(n-1)|u_(n-1)| {[mu][delta]u_(n-1)}| [delta]²u_(n-1)| {[mu][delta]³u_(n-1)}| [delta]^4u_(n-1) ... |
    |       |       |   [delta]u_(n-½)    |                |    [delta]³u_(n-2    |                      |
    |x_n    |u_n    |  ([mu][delta]u_n)   | [delta]²u_n    |  ([mu][delta]³u_n)   | [delta]^4u_n     ... |
    |       |       |   [delta]u_(n+½)    |                |     [delta]³u_(n+½)  |                      |
    |x_(n+1)|u_(n+1)| {[mu][delta]u_(n+1)}| [delta]²u_(n+1)| {[mu][delta]³u_(n+1)}| [delta]^4u_(n+1) ... |
    |       |       |   [delta]u_(n+3/2)  |                |  [delta]³u_(n+3/2)   |                      |
    |x_(n+2)|u_(n+2)| {[mu][delta]u_(n+2)}| [delta]²u_(n+2)| {[mu][delta]³u_(n+2)}| [delta]^4u_(n+2) ... |
    |   .   |   .   |          .          |        .       |           .          |           .          |
    |   .   |   .   |          .          |        .       |           .          |           .          |
    |   .   |   .   |          .          |        .       |           .          |           .          |
    +-------+-------+---------------------+----------------+----------------------+----------------------+

  Similarly, by taking the means of consecutive values of u and also of
  consecutive differences of even order, we should get a series of terms
  and differences central to the intervals x_(n-2) to x_(n-1), x_(n-1)
  to x_n, ....

  The terms of the series of which the values of u are the first
  differences are denoted by [sigma]u, with suffixes on the same
  principle; the suffixes being chosen so that [delta][sigma]un shall be
  equal to un. Thus, if

    [sigma]u_(n-3/2) = C + u_(n-2),

  then

    [sigma]u_(n-½) = C + u_(n-2) + u_(n-1), [sigma]_(n+½)
       = C + u_(n-2) + u_(n-1) + u_n, &c.,

  and also

    [mu][sigma]u_(n-1) = C + u_(n-2) + ½u_(n-1), [mu][sigma]u_n
       = C + u_(n-2) + u_(n-1) + ½u_n, &c.,

  C being an arbitrary constant which must remain the same throughout
  any series of operations.


  _Operators and Symbolic Methods._

  12. There are two further stages in the use of the symbols [Delta],
  [Sigma], [delta], [sigma], &c., which are not essential for elementary
  treatment but lead to powerful methods of deduction.

  (i.) Instead of treating [Delta]u as a function of x, so that
  [Delta]u_n means ([Delta]u)_n, we may regard [Delta] as denoting an
  _operation_ performed on u, and take [Delta]un as meaning [Delta].u_n.
  This applies to the other symbols E, [delta], &c., whether taken
  simply or in combination. Thus [Delta]Eu_n means that we first replace
  un by un+1, and then replace this by u_(n+2) - u_(n+1).

  (ii.) The operations [Delta], E, [delta], and [mu], whether performed
  separately or in combination, or in combination also with numerical
  multipliers and with the operation of differentiation denoted by D (:=
  d/dx), follow the ordinary rules of algebra: e.g. [Delta](u_n + v_n) =
  [Delta]u_n + [Delta]v_n, [Delta]Du_n = D[Delta]u_n, &c. Hence the
  symbols can be separated from the functions on which the operations
  are performed, and treated as if they were algebraical quantities. For
  instance, we have

    E·u_n = u_(n+1) = u_n + [Delta]u_n = 1·u_n + [Delta]·u_n,

  so that we may write E = 1 + [Delta], or [Delta] = E - 1. The first of
  these is nothing more than a statement, in concise form, that if we
  take two quantities, subtract the first from the second, and add the
  result to the first, we get the second. This seems almost a truism.
  But, if we deduce E^n = (1 + [Delta])^n, [Delta]^n = (E-1)^n, and
  expand by the binomial theorem and then operate on u0, we get the
  general formulae

                           n·n - 1
    un = u0 + n[Delta]u0 + ------- [Delta]^2u0 + ... + [Delta]^nu0,
                             1·2
                                   n·n - 1
    [Delta]^nu0 = u_n - nu_(n-1) + ------- u_(n-2) + ... + (-1)^nu0,
                                     1·2

  which are identical with the formulae in (ii.) and (i.) of § 3.

  (iii.) What has been said under (ii.) applies, with certain
  reservations, to the operations [Sigma] and [sigma], and to the
  operation which represents integration. The latter is sometimes
  denoted by D^-1; and, since [Delta][Sigma]un = un, and
  [delta][sigma]u_n = u_n, we might similarly replace [Sigma] and
  [sigma] by [Delta]^-1 and [delta]^-1. These symbols can be combined
  with [Delta], E, &c. according to the ordinary laws of algebra,
  provided that proper account is taken of the arbitrary constants
  introduced by the operations D^-1, [Delta]^-1, [delta]^-1.


  _Applications to Algebraical Series._

  13. _Summation of Series._--If ur, denotes the (r+1)th term of a
  series, and if vr is a function of r such that [Delta]v_r = u_r for
  all integral values of r, then the sum of the terms u_m, u_(m+1), ...
  un is v_(n+1) -v_m. Thus the sum of a number of terms of a series may
  often be found by inspection, in the same kind of way that an integral
  is found.

  14. _Rational Integral Functions._--(i.) If u_r is a rational integral
  function of r of degree p, then [Delta]ur, is a rational integral
  function of r of degree p-1.

  (ii.) A particular case is that of a _factorial_, i.e. a product of
  the form (r+a+1) (r+a+2) ... (r+b), each factor exceeding the
  preceding factor by 1. We have

    [Delta]·(r+a+1) (r+a+2) ... (r+b) = (b-a)·(r+a+2) ... (r+b),

  whence, changing a into a-1,

    [Sigma](r+a+1)(r+a+2) ... (r+b) = _const._ + (r+a)(r+a+1) ...
      (r+b)/(b-a+1).

  A similar method can be applied to the series whose (r+1)th term is of
  the form 1/(r+a+1) (r+a+2) ... (r+b).

  (iii.) Any rational integral function can be converted into the sum of
  a number of factorials; and thus the sum of a series of which such a
  function is the general term can be found. For example, it may be
  shown in this way that the sum of the pth powers of the first n
  natural numbers is a rational integral function of n of degree p+1,
  the coefficient of n^p+1 being 1/(p+1).

  15. _Difference-equations._--The summation of the series ... + u_(n+2)
  + u_(n-1) + u_n is a solution of the _difference-equation_ [Delta]v_n
  = u_(n+1), which may also be written (E-1)v_n = u_(n+1). This is a
  simple form of difference-equation. There are several forms which have
  been investigated; a simple form, more general than the above, is the
  _linear equation_ with _constant coefficients_--

    v_(n+m) + a1v_(n+m-1) + a2v_(n+m-2) + ... + a_mv_n = N,

  where a1, a2, ... am are constants, and N is a given function of n.
  This may be written

    (E^m + a1E^(m-1) + ... + a_m)v_n = N

  or

    (E-p1)(E-p2) ... (E-p_m)v_n = N.

  The solution, if p1, p2, ... pm are all different, is vn = C1p1^n +
  C2p2^n + ... + C_mp_m^n + V_n, where C1, C2 ... are constants, and v_n
  = V_n is any one solution of the equation. The method of finding a
  value for Vn depends on the form of N. Certain modifications are
  required when two or more of the p's are equal.

  It should be observed, in all cases of this kind, that, in describing
  C1, C2 as "constants," it is meant that the value of any one, as C1,
  is the same for all values of n occurring in the series. A "constant"
  may, however, be a periodic function of n.


  _Applications to Continuous Functions._

  16. The cases of greatest practical importance are those in which u is
  a continuous function of x. The terms u1, u2 ... of the series then
  represent the successive values of u corresponding to x = x1, x2....
  The important applications of the theory in these cases are to (i.)
  relations between differences and differential coefficients, (ii.)
  interpolation, or the determination of intermediate values of u, and
  (iii.) relations between sums and integrals.

  17. Starting from any pair of values x0 and u0, we may suppose the
  interval h from x0 to x1 to be divided into q equal portions. If we
  suppose the corresponding values of u to be obtained, and their
  differences taken, the successive advancing differences of u0 being
  denoted by dPu0, dP²u0 ..., we have (§ 3 (ii.))

                         q·q - 1
    u1  = u0  + qdPu0  + ------- dP²u0  + ....
                           1·2

  When q is made indefinitely great, this (writing f(x) for u) becomes
  Taylor's Theorem (INFINITESIMAL CALCULUS)

                                h²
    f(x + h) = f(x) + hf'(x) + --- f"(x) + ...,
                               1·2

  which, expressed in terms of operators, is

                  h²       h³
    E = 1 + hD + ---D² + ----- D³ + ... = e^(hD).
                 1·2     1·2·3

  This gives the relation between [Delta] and D. Also we have

                         2q·2q - 1
    u2 = u0  + 2qdPu0  + --------- dP²u0  + ...
                            1·2

                         3q·3q - 1
    u3 = u0  + 3qdPu0  + --------- dP²u0  + ...
                            1·2
    .            .
    .            .
    .            .

  and, if p is any integer,

                           p·p - 1
    u_(p/q) = u0 + pdPu0 + ------- dP²u0 + ....
                             1·2

  From these equations up/q could be expressed in terms of u0, u1, u2,
  ...; this is a particular case of interpolation (q.v.).

  18. _Differences and Differential Coefficients._--The various formulae
  are most quickly obtained by symbolical methods; i.e. by dealing with
  the operators [Delta], E, D, ... as if they were algebraical
  quantities. Thus the relation E = e^(hD) (§ 17) gives

    hD = log_e  (1 + [Delta]) = [Delta] - ½[Delta]² + 1/3 [Delta]³ ...

         /du\
    or h( -- ) = [Delta]u0 - ½[Delta]²u0 + 1/3 [Delta]³u0  ....
         \dx/0

  The formulae connecting central differences with differential
  coefficients are based on the relations [mu] = cosh ½hD = ½(e^ ½hD +
  e^ -½hD), [delta] = 2 sinh ½hD - e^ ½hD - e^ -½hD, and may be grouped
  as follows:--

              u0  = u0                                              \
                                                                    |
    [mu][delta]u0 = (hD + 1/6 h³D³ + 1/120 h^5 D^5 + ...)u0         |
                                                                    |
       [delta]²u0 = (h²D² + 1/12 h^4 D^4 + 1/360 h^6 D^6 + ...)u0    >
                                                                    |
   [mu][delta]³u0 = (h³D³ + 1/4 h^5 D^5 + ...)u0                    |
                                                                    |
     [delta]^4 u0 = (h^4 D^4 + 1/6 h^6 D^6 + ...)u0                 /

                  .                .             .
                  .                .             .
                  .                .             .

          [mu]u_½ = (1 + 1/8 h²D² + 1/384 h^4 D^4 + 1/46080 h^6 D^6 + ...)u_½ \
                                                                              |
       [delta]u_½ = (hD + 1/24 h³D³ + 1/1920 h^5 D^5 + ...)u_½                |
                                                                              |
   [mu][delta]²u_½ = (h²D² + 5/24 h^4 D^4 + 91/5760 h^6 D^6 + ...)u_½          >
                                                                              |
      [delta]³u_½ = (h³D³ + 1/8 h^5 D^5 + ...)u_½                             |
                                                                              |
   [mu][delta]^4 u_½ = (h^4 D^4 + 7/24 h^6 D^6 + ...)u_½                      /

                  .                .             .
                  .                .             .
                  .                .             .

               u0 = u0                                                             \
                                                                                   |
            hDu0  = ([mu][delta] - 1/6 [mu][delta]³ + 1/30 [mu][delta]^5  - ...)u0 |
                                                                                   |
           h²D²u0 = ([delta]² - 1/12 [delta]^4 + 1/90 [delta]^6 - ...)u0            >
                                                                                   |
          h³D³u0  = ([mu][delta]³ 1/4 [mu][delta]^5  + ...)u0                      |
                                                                                   |
      h^4 D^4 u_0 = ([delta]^4 - 1/6 [delta]^6 + ...)u0                            /

                  .                .             .
                  .                .             .
                  .                .             .

              u_½ = ([mu] - 1/8 [mu][delta]² + 3/128 [mu][delta]^4 - 5/1024 [mu][delta]^6 + ...)u_½ \
                                                                                                    |
           hDu_½  = ([delta] - 1/24 [delta]³ + 3/640 [delta]^5 - ...)u_½                            |
                                                                                                    |
          h²D²u_½ = ([mu][delta]² - 5/24 [mu][delta]^ + 259/5760 [mu][delta]^6 - ...)u_½             >
                                                                                                    |
         h³D³u_½  = ([delta]³ - 1/8 [delta]^5 + ...)u_½                                             |
                                                                                                    |
      h^4 D^4 u_½ = ([mu][delta]^4 - 7/24 [mu][delta]^6 + ...)u_½                                   /

                  .                .             .
                  .                .             .
                  .                .             .

  When u is a rational integral function of x, each of the above series
  is a terminating series. In other cases the series will be an infinite
  one, and may be divergent; but it may be used for purposes of
  approximation up to a certain point, and there will be a "remainder,"
  the limits of whose magnitude will be determinate.

  19. _Sums and Integrals._--The relation between a sum and an integral
  is usually expressed by the _Euler-Maclaurin formula_. The principle
  of this formula is that, if um and um+1, are ordinates of a curve,
  distant h from one another, then for a first approximation to the area
  of the curve between um and um+1 we have ½h(u_m + u_m+1), and the
  difference between this and the true value of the area can be
  expressed as the difference of two expressions, one of which is a
  function of x_m, and the other is the same function of x_m+1. Denoting
  these by [phi](x_m) and [phi](xm+1), we have

      _ x_m+1
     /
     |   udx = ½h(u_m  + u_m+1) + [phi](x_m+1 ) - [phi](x_m).
    _/x_m

  Adding a series of similar expressions, we find

      _ x_n
     /
     |  udx = h{½u_m + u_m+1 + u_m+2 + ... + u_n-1 + ½u_n} + [phi](x_n) - [phi](x_m).
    _/x_m

  The function [phi](x) can be expressed in terms either of differential
  coefficients of u or of advancing or central differences; thus there
  are three formulae.

  (i.) The Euler-Maclaurin formula, properly so called, (due
  independently to Euler and Maclaurin) is

      _ x_n
     /                             1    du_n    1       d³u_n     1       d^5 u_n
     |   udx = h·[mu][sigma]u_n - -- h² ---- + --- h^4  ----- - ----- h^6 ------- + ...
    _/x_m                         12     dx    720       dx³    30240       dx^5

                                  B1    du_n   B2     d³u_n   B3     d^5u_n
             = h·[mu][sigma]u_n - -- h2 ---- + -- h^4 ----- - -- h^6 ------ + ...,
                                  2!     dx    4!      dx³    6!      dx^5

  where B1, B2, B3 ... are _Bernoulli's numbers_.

  (ii.) If we express differential coefficients in terms of advancing
  differences, we get a theorem which is due to Laplace:--

        _ x_n
    1  /
    -  |  udx = [mu][sigma](u_n - u0) - 1/12 ([Delta]u_n - [Delta]u0) + 1/24 ( [Delta]²u_n - [Delta]²u0)
    h _/x0

           - 19/720 ([Delta]³u_n - [Delta]³u_0) + 3/160 ([Delta]^4 u_n - [Delta]^4 u0) - ...


  For practical calculations this may more conveniently be written

        _ x_n
    1  /
    -  |  udx = [mu][sigma](u_n - u0) + 1/12 ([Delta]u0 - ½[Delta]²u0 + 19/60 [Delta]³u0 - ...)
    h _/x0

                 + 1/12 ([Delta]'u_n - ½[Delta]'²u_n + 19/60 [Delta]'³u_n - ...),

  where accented differences denote that the values of u are read
  backwards from un; i.e. [Delta]'un denotes u_n-1 - u_n, not (as in §
  10) u_n - u_n-1.

  (iii.) Expressed in terms of central differences this becomes

        _ x_n
    1  /
    -  |   udx = [mu][sigma](u_n - u0) - 1/12 [mu][delta]u_n + 11/720 [mu][delta]³u_n - ...
    h _/x0
                            + 1/12 [mu][delta]u0  - 11/720 [mu][delta]³u0 + ...

           /          1            11             191               2497                 \  /      \
    = [mu]([sigma] - -- [delta] + --- [delta]³ - ----- [delta]^5 + ------- [delta]^7 - ...)(u_n - u0).
           \         12           720            60480             3628800               /  \      /

  (iv.) There are variants of these formulae, due to taking hum+½ as the
  first approximation to the area of the curve between um and um+1; the
  formulae involve the sum u_½ + u_3/2 + ... + u_n-½ := [sigma](u_n -
  u0) (see MENSURATION).

  20. The formulae in the last section can be obtained by symbolical
  methods from the relation

        _
    1  /       1         1
    -  | udx = - D^1 u = --·u.
    h _/       h         hD

  Thus for central differences, if we write [theta] := ½hD, we have [mu]
  = cosh [theta], [delta] = 2 sinh [theta], [sigma] = [delta]^-1, and
  the result in (iii.) corresponds to the formula

                                        / /   1                 2                   2·4                    \
    sinh [theta] = [theta] cosh [theta]/ (1 + - sinh²[theta] - --- sinh^4[theta] + ----- sinh^6[theta] - ...).
                                      /   \   3                3·5                 3·5·7                   /

  REFERENCES.--There is no recent English work on the theory of finite
  differences as a whole. G. Boole's _Finite Differences_ (1st ed.,
  1860, 2nd ed., edited by J. F. Moulton, 1872) is a comprehensive
  treatise, in which symbolical methods are employed very early. A. A.
  Markoff's _Differenzenrechnung_ (German trans., 1896) contains general
  formulae. (Both these works ignore central differences.) _Encycl. der
  math. Wiss._ vol. i. pt. 2, pp. 919-935, may also be consulted. An
  elementary treatment of the subject will be found in many text-books,
  e.g. G. Chrystal's _Algebra_ (pt. 2, ch. xxxi.). A. W. Sunderland,
  _Notes on Finite Differences_ (1885), is intended for actuarial
  students. Various central-difference formulae with references are
  given in _Proc. Lond. Math. Soc._ xxxi. pp. 449-488. For other
  references see INTERPOLATION.     (W. F. SH.)

## See also

- [[Deschamps]]
- [[Caste]]

## References

- <https://en.wikisource.org/wiki/1911_Encyclopædia_Britannica/Differences>

#religion
